/**
 * API de transition toolso-media (/v1/…) sur un PostgreSQL embarqué : mêmes routes, mêmes clés et mêmes réponses que
 * l'API REST de media, effets dans la base v2 (contacts, inscriptions, événements, statuts).
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const { startEmbeddedPostgres } = require('../lib/embedded-pg');

jest.setTimeout(180000);

const ROOT = path.join(__dirname, '..', '..');
const MEDIA_KEY = 'mediaCrmKey0123456789abcdefghijkl';
const V2_KEY = 'v2InterfaceKey0123456789abcdefghi';
const SOURCE_KEY = 'mediaSourceKey0123456789abcdefgh';
let pg;
let request;
let sequelizeModule;
let conversionServer;
let conversionReceived = [];

beforeAll(async () => {
  const databaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emailing-pg-'));
  const filesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emailing-files-'));
  pg = await startEmbeddedPostgres({ databaseDir, persistent: false, quiet: true, databases: ['emailing_test', 'media'] });

  // faux service de conversions media
  conversionServer = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      conversionReceived.push({ url: req.url, body: JSON.parse(body) });
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ status: 'ok' }));
    });
  });
  await new Promise((resolve) => conversionServer.listen(0, '127.0.0.1', resolve));

  Object.assign(process.env, {
    RESOURCE_UID: 'test',
    MEDIA_PRODUCT_UIDS: 'monsite',
    MEDIA_CONVERSION_URL: `http://127.0.0.1:${conversionServer.address().port}/v1/ad/click/conversion`,
    DATABASE_URL: pg.databaseUrl(),
    JWT_SECRET: 'test-secret',
    PUBLIC_URL: 'https://emailing.example.com',
    API_PUBLIC_URL: 'https://emailing.example.com/api/test',
    FILES_DIR: filesDir,
    FILES_PUBLIC_URL: 'https://emailing.example.com/files/test',
    TZ: 'Europe/Paris',
    LOG_LEVEL: 'WARN'
  });
  delete process.env.SMTP_URL;
  process.chdir(ROOT);

  sequelizeModule = require('../../src/storage/sequelize');
  const sequelize = await sequelizeModule.initWithPostgresql(5);
  const { syncModel } = require('../../src/storage/syncModel');
  await syncModel(sequelize);

  // clés media reprises par la migration (table api_key d'une base media)
  const { Client } = require('pg');
  const media = new Client({ connectionString: pg.databaseUrl('media') });
  await media.connect();
  await media.query('CREATE TABLE api_key (id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, name varchar(255), key varchar(255), created_at timestamptz, updated_at timestamptz)');
  await media.query('INSERT INTO api_key (name, key) VALUES ($1, $2), ($3, NULL)', ['CRM', MEDIA_KEY, 'Sans clé']);
  const { migrateApiKeysFromMedia } = require('../../src/migration/mediaDatabase');
  const dry = await migrateApiKeysFromMedia({ sequelize, source: media, dryRun: true });
  expect(dry).toMatchObject({ read: 1, created: 1, dryRun: true });
  expect(await sequelize.models.ApiKey.count()).toBe(0);
  const first = await migrateApiKeysFromMedia({ sequelize, source: media });
  expect(first).toMatchObject({ read: 1, created: 1, existing: 0 });
  const again = await migrateApiKeysFromMedia({ sequelize, source: media });
  expect(again).toMatchObject({ created: 0, existing: 1 });
  await media.end();

  await sequelize.models.ApiKey.create({ name: 'interface', apiKey: V2_KEY, enabled: true, permissions: {} });
  await sequelize.models.ContactSource.create({ name: 'PartenaireCRM', utmSource: 'PartenaireCRM' });
  await sequelize.models.ContactSource.create({
    name: 'Formulaire',
    utmSource: 'formulaire',
    apiKey: SOURCE_KEY,
    apiEnabled: true,
    apiFields: {
      email: { enabled: true, required: true },
      firstname: { enabled: true, required: true, validators: [{ type: 'only_letter_validation' }] },
      origine: { enabled: true, type: 'manual', value: 'site' }
    }
  });

  const app = require('../../src/api/api').initApi();
  request = require('supertest')(app);
});

afterAll(async () => {
  await sequelizeModule.close();
  await pg.stop();
  await new Promise((resolve) => conversionServer.close(resolve));
});

const models = () => sequelizeModule.get().models;

const INSCRIPTION = {
  email: ' Alice@Orange.fr ',
  firstname: 'Alice',
  lastname: 'Martin',
  gender: 'f',
  dob: '1980-05-17',
  city: 'Lyon',
  street: '1 rue de la Paix',
  zipcode: '69001',
  phone: '0600000000',
  fields: { pid: 'abc123' },
  source_name: 'PartenaireCRM',
  collect_url: 'https://site.example.com/jeu',
  collect_ip: '203.0.113.7'
};

describe('authentification (comme media)', () => {
  test('sans clé : { status: ko, code: unauthorized } en 200', async () => {
    const res = await request.post('/v1/monsite/contacts/').send(INSCRIPTION);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ko', code: 'unauthorized' });
  });

  test('clé inconnue ou produit non servi par cette instance : unauthorized', async () => {
    const bad = await request.post('/v1/monsite/contacts/').set('apikey', 'inconnue').send(INSCRIPTION);
    expect(bad.body.code).toBe('unauthorized');
    const other = await request.post('/v1/autresite/contacts/').set('apikey', MEDIA_KEY).send(INSCRIPTION);
    expect(other.body).toEqual({ status: 'ko', code: 'unauthorized' });
  });

  test("une clé reprise de media n'ouvre pas les routes v2", async () => {
    const res = await request.post('/v2/contacts/').set('apikey', MEDIA_KEY).send({ email: 'x@orange.fr' });
    expect(res.status).toBe(403);
    // une clé v2 ordinaire est acceptée sur les deux
    const ok = await request.get('/v1/monsite/contacts/check').set('api-key', V2_KEY).query({ email: 'y@orange.fr' });
    expect(ok.body).toEqual({ status: 'ok', code: 'inscription_acceptable' });
  });
});

describe('routes produit /v1/:product_uid/…', () => {
  test('POST contacts/ : inscription, champs et collecte, réponse contact_accepted au format media', async () => {
    const res = await request.post('/v1/monsite/contacts/').set('apikey', MEDIA_KEY).send(INSCRIPTION);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.code).toBe('contact_accepted');
    expect(res.body.contact).toMatchObject({
      email: 'alice@orange.fr',
      firstname: 'Alice',
      lastname: 'Martin',
      gender: 'f',
      dob: '1980-05-17',
      city: 'Lyon',
      zipcode: '69001',
      phone: '0600000000',
      fields: { pid: 'abc123' },
      email_status: 'new',
      esp: expect.any(String),
      md5: expect.any(String)
    });

    const contact = await models().Contact.findOne({ where: { email: 'alice@orange.fr' } });
    expect(contact.customFields).toEqual({ pid: 'abc123' });
    const inscription = await models().ContactInscription.findOne({ where: { contactId: contact.id } });
    expect(inscription.ip).toBe('203.0.113.7');
    expect(inscription.collectUrl).toBe('https://site.example.com/jeu');
    const source = await models().ContactSource.findOne({ where: { name: 'PartenaireCRM' } });
    expect(inscription.sourceId).toBe(source.id);
  });

  test('POST contacts/ : source_name inconnue → source créée (comme media)', async () => {
    const res = await request.post('/v1/monsite/contacts/').set('apikey', MEDIA_KEY).send({ email: 'bob@orange.fr', source_name: 'NouvellePartenaire' });
    expect(res.body.code).toBe('contact_accepted');
    expect(await models().ContactSource.count({ where: { utmSource: 'NouvellePartenaire' } })).toBe(1);
  });

  test('POST contacts/ : e-mail absent ou invalide → invalid_payload', async () => {
    const missing = await request.post('/v1/monsite/contacts/').set('apikey', MEDIA_KEY).send({ firstname: 'X' });
    expect(missing.body).toEqual({ status: 'ko', code: 'invalid_payload', message: 'The payload is invalid.', errors: [{ field: 'email', message: 'Required field' }] });
    const invalid = await request.post('/v1/monsite/contacts/').set('apikey', MEDIA_KEY).send({ email: 'pas-un-email' });
    expect(invalid.body.errors).toEqual([{ field: 'email', message: 'Email is invalid' }]);
  });

  test('POST contacts/ : corps application/x-www-form-urlencoded accepté', async () => {
    const res = await request.post('/v1/monsite/contacts/').set('apikey', MEDIA_KEY).type('form').send({ email: 'form@orange.fr', firstname: 'Form' });
    expect(res.body.code).toBe('contact_accepted');
    expect(res.body.contact.firstname).toBe('Form');
  });

  test('GET contacts/check et GET contacts/:email', async () => {
    const check = await request.get('/v1/monsite/contacts/check').set('apikey', MEDIA_KEY).query({ email: 'nouveau@orange.fr' });
    expect(check.body).toEqual({ status: 'ok', code: 'inscription_acceptable' });
    const noEmail = await request.get('/v1/monsite/contacts/check').set('apikey', MEDIA_KEY);
    expect(noEmail.body.code).toBe('invalid_payload');

    const found = await request.get(`/v1/monsite/contacts/${encodeURIComponent('alice@orange.fr')}`).set('apikey', MEDIA_KEY);
    expect(found.body.email).toBe('alice@orange.fr');
    expect(found.body.fields).toEqual({ pid: 'abc123' });
    const missing = await request.get('/v1/monsite/contacts/inconnu@orange.fr').set('apikey', MEDIA_KEY);
    expect(missing.body).toEqual({ status: 'ko', code: 'contact_not_found', message: 'Contact not found' });
  });

  test('POST contacts/pixel_tracking_consent', async () => {
    const res = await request.post('/v1/monsite/contacts/pixel_tracking_consent').set('apikey', MEDIA_KEY).send({ email: 'alice@orange.fr', pixel_tracking_consent: false, source: 'cmp' });
    expect(res.body.status).toBe('ok');
    expect(res.body.code).toBe('pixel_tracking_consent_updated');
    expect(res.body.contact.pixel_tracking_consent).toBe(false);
    const bad = await request.post('/v1/monsite/contacts/pixel_tracking_consent').set('apikey', MEDIA_KEY).send({ email: 'alice@orange.fr' });
    expect(bad.body.code).toBe('invalid_payload');
  });

  test('POST unsubscriptions/ : événement unsub et statut recalculé, puis réinscription', async () => {
    const res = await request.post('/v1/monsite/unsubscriptions/').set('apikey', MEDIA_KEY).send({ email: 'alice@orange.fr', reason: 'trop de mails', ip: '203.0.113.8' });
    expect(res.body).toEqual({ status: 'ok' });
    const contact = await models().Contact.findOne({ where: { email: 'alice@orange.fr' } });
    expect(contact.status).toBe('unsub');
    const event = await models().ContactEvent.findOne({ where: { contactId: contact.id, type: 'unsub' } });
    expect(event).not.toBeNull();
    const shown = await request.get('/v1/monsite/contacts/alice@orange.fr').set('apikey', MEDIA_KEY);
    expect(shown.body.email_status).toBe('unsub');

    const unknown = await request.post('/v1/monsite/unsubscriptions/').set('apikey', MEDIA_KEY).send({ email: 'inconnu@orange.fr' });
    expect(unknown.body).toEqual({ status: 'ko', message: 'Contact not found' });

    // comme media : une nouvelle inscription annule le désabonnement (v2 : unsub seulement après la dernière inscription)
    await new Promise((r) => setTimeout(r, 20));
    const again = await request.post('/v1/monsite/contacts/').set('apikey', MEDIA_KEY).send({ email: 'alice@orange.fr' });
    expect(again.body.contact.email_status).not.toBe('unsub');
  });

  test('GET contacts/export : CSV, colonnes et dédoublonnage ; filtre media non traduit refusé', async () => {
    const res = await request
      .get('/v1/contacts/export')
      .set('apikey', MEDIA_KEY)
      .query({ fields: 'email,firstname,fields.pid,email_status', filter: JSON.stringify({ product_id: 167 }) });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/_test_contacts\.csv$/);
    const lines = res.text.split('\n');
    expect(lines[0]).toBe('"email","firstname","fields.pid","email_status"');
    expect(lines).toContain('"alice@orange.fr","Alice","abc123","new"');

    const unique = await request.get('/v1/contacts/export').set('apikey', MEDIA_KEY).query({ fields: 'email_status', unique_fields: 'email_status' });
    const statuses = unique.text.split('\n').slice(1);
    expect(new Set(statuses).size).toBe(statuses.length);

    const refused = await request
      .get('/v1/contacts/export')
      .set('apikey', MEDIA_KEY)
      .query({ filter: JSON.stringify({ type: 'and', children: [] }) });
    expect(refused.status).toBe(400);
    expect(refused.body.code).toBe('unsupported_filter');
    const anonymous = await request.get('/v1/contacts/export');
    expect(anonymous.body.code).toBe('unauthorized');
  });

  test('DELETE contacts/ : suppression définitive', async () => {
    const res = await request.delete('/v1/monsite/contacts/').set('apikey', MEDIA_KEY).send({ email: 'bob@orange.fr' });
    expect(res.body).toEqual({ status: 'ok' });
    expect(await models().Contact.count({ where: { email: 'bob@orange.fr' } })).toBe(0);
    const again = await request.delete('/v1/monsite/contacts/').set('apikey', MEDIA_KEY).send({ email: 'bob@orange.fr' });
    expect(again.body).toEqual({ status: 'ko', code: 'contact_not_found', message: 'Contact not found' });
  });
});

describe('routes source /v1/source/…', () => {
  test('clé absente ou inconnue', async () => {
    const none = await request.post('/v1/source/contacts/').send({ email: 'c@orange.fr' });
    expect(none.body.code).toBe('no_api_key');
    const bad = await request.post('/v1/source/contacts/').set('apikey', 'inconnue').send({ email: 'c@orange.fr' });
    expect(bad.body).toEqual({ status: 'ko', code: 'invalid_api_key', message: 'Invalid api key.' });
  });

  test('POST : champs de la source (obligatoires, validateurs, manuels), clé dans le corps acceptée', async () => {
    const missing = await request.post('/v1/source/contacts/').set('apikey', SOURCE_KEY).send({ email: 'carla@orange.fr' });
    expect(missing.body.code).toBe('invalid_payload');
    expect(missing.body.errors).toEqual([{ field: 'firstname', message: 'Required fields' }]);
    const letters = await request.post('/v1/source/contacts/').send({ apikey: SOURCE_KEY, email: 'carla@orange.fr', firstname: 'C4rla' });
    expect(letters.body.errors).toEqual([{ field: 'firstname', message: 'Must contain only letters' }]);

    const ok = await request.post('/v1/source/contacts/').send({ apikey: SOURCE_KEY, email: 'carla@orange.fr', firstname: 'Carla', ignore: 'x' });
    expect(ok.body).toEqual({ status: 'ok', code: 'contact_accepted' });
    const contact = await models().Contact.findOne({ where: { email: 'carla@orange.fr' } });
    expect(contact.firstname).toBe('Carla');
    expect(contact.customFields).toEqual({ origine: 'site' });
    const source = await models().ContactSource.findOne({ where: { apiKey: SOURCE_KEY } });
    expect(await models().ContactInscription.count({ where: { contactId: contact.id, sourceId: source.id } })).toBe(1);
  });

  test('GET check, puis source désactivée → campaign_disabled', async () => {
    const check = await request.get('/v1/source/contacts/check').set('apikey', SOURCE_KEY).query({ email: 'dan@orange.fr' });
    expect(check.body).toEqual({ status: 'ok', code: 'inscription_acceptable' });
    await models().ContactSource.update({ apiEnabled: false }, { where: { apiKey: SOURCE_KEY } });
    const disabled = await request.post('/v1/source/contacts/').set('apikey', SOURCE_KEY).send({ email: 'dan@orange.fr', firstname: 'Dan' });
    expect(disabled.body).toEqual({ status: 'ko', code: 'campaign_disabled', message: 'This campaign is currently disabled.' });
  });
});

describe('conversions /v1/ad/click/conversion', () => {
  test('sans tsclid : 400 no_tsclid ; sinon transférée telle quelle à media', async () => {
    const bad = await request.post('/v1/ad/click/conversion').send({ revenue: 1 });
    expect(bad.status).toBe(400);
    expect(bad.body).toEqual({ status: 'error', code: 'no_tsclid' });
    const res = await request.post('/v1/ad/click/conversion').send({ tsclid: 'abc', revenue: 2.5, uid: 'u1' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
    expect(conversionReceived).toEqual([{ url: '/v1/ad/click/conversion', body: { tsclid: 'abc', revenue: 2.5, uid: 'u1' } }]);
  });
});
