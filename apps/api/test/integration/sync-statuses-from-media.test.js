/**
 * Synchronisation des statuts toolso-media → v2 pendant la transition (src/migration/mediaStatusSync.js), sur PostgreSQL
 * embarqué (media_src : sous-ensemble du schéma media ; emailing_test : schéma v2) : reprise, puis événements survenus dans
 * media après la bascule (désabonnement par historique et drapeau, plainte, hard bounce sans historique, désabonnement
 * antérieur au dernier événement intégré au cache, réinscription, nouveau contact, blacklist), simulation, idempotence,
 * job planifié.
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const md5 = require('md5');
const { Client } = require('pg');
const { startEmbeddedPostgres } = require('../lib/embedded-pg');

jest.setTimeout(180000);

const ROOT = path.join(__dirname, '..', '..');
let pg;
let sequelizeModule;
let source;
let media;
let sync;

const ago = (days, hours = 0) => new Date(Date.now() - (days * 24 + hours) * 3600000);
const iso = (d) => d.toISOString();
const SENDABLE = ['new', 'workable'];

const PEOPLE = ['alice', 'bob', 'carol', 'dave', 'frank', 'gina'];

const seedSource = async () => {
  await source.query(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'media-schema.sql'), 'utf8'));
  const q = (sql, params) => source.query(sql, params);
  await q(`INSERT INTO product (uid, name, disabled, created_at, updated_at) VALUES ('guide', 'Guide', false, now(), now()), ('autre', 'Autre', false, now(), now())`);
  await q(`INSERT INTO contact_source (product_id, name, utm_source, created_at, updated_at) VALUES (1, 'Formulaire site', 'site', now(), now())`);
  // six contacts actifs du produit 1 (ids 1 à 6), inscrits il y a 20 jours, une ouverture il y a 5 jours
  for (const [i, name] of PEOPLE.entries()) {
    await q(
      `INSERT INTO contact (email, firstname, product_id, email_status, stats, created_at, updated_at, last_status_update) VALUES ($1, $2, 1, 'active', '{"emailing":{"request":3,"open":2}}', $3, $3, $3)`,
      [`${name}@example.com`, name, iso(ago(20))]
    );
    await q(`INSERT INTO inscription (contact_id, product_id, contact_source_id, inscripted_at, fields, source_name, email, is_new, created_at, updated_at) VALUES ($1, 1, 1, $2, '{}', 'Formulaire site', $3, true, $2, $2)`, [i + 1, iso(ago(20)), `${name}@example.com`]);
    await q(`INSERT INTO email (contact_id, product_id, message_id, sent_at, sent, opened, opened_at, delivered, esp, created_at, updated_at) VALUES ($1, 1, $2, $3, true, true, $4, true, 'unknown', $3, $4)`, [
      i + 1,
      `msg-${name}`,
      iso(ago(5)),
      iso(ago(5, -1))
    ]);
  }
  // frank s'est désabonné avant la reprise (historique + statut)
  await q(`UPDATE contact SET email_status = 'unsub', last_status_update = $1, updated_at = $1 WHERE id = 5`, [iso(ago(3))]);
  await q(`INSERT INTO contact_history (product_id, contact_id, type, details, date, created_at, updated_at) VALUES (1, 5, 'emailing_unsub', '{"origin":"link"}', $1, $1, $1)`, [iso(ago(3))]);
  // un contact d'un autre produit de la même base : jamais lu
  await q(`INSERT INTO contact (email, product_id, email_status, created_at, updated_at) VALUES ('other@example.com', 2, 'unsub', now(), now())`);
  await q(`INSERT INTO contact_history (product_id, contact_id, type, date, created_at, updated_at) VALUES (2, 7, 'emailing_unsub', now(), now(), now())`);
};

/** Ce qui arrive dans media après la bascule (contacts 1 à 6 = PEOPLE). */
const mediaEventsAfterSwitch = async () => {
  const q = (sql, params) => source.query(sql, params);
  const t = iso(ago(0, 0.5));
  // alice : lien de désabonnement d'un mail media (historique + drapeau de l'envoi + statut)
  await q(`UPDATE contact SET email_status = 'unsub', updated_at = $1 WHERE id = 1`, [t]);
  await q(`UPDATE email SET unsubcribed = true, updated_at = $1 WHERE contact_id = 1`, [t]);
  await q(`INSERT INTO contact_history (product_id, contact_id, type, details, date, created_at, updated_at) VALUES (1, 1, 'emailing_unsub', '{"origin":"link","ip":"1.2.3.4"}', $1, $1, $1)`, [t]);
  // bob : plainte remontée par l'ESP
  await q(`UPDATE contact SET email_status = 'complaint', updated_at = $1 WHERE id = 2`, [t]);
  await q(`INSERT INTO contact_history (product_id, contact_id, type, details, date, created_at, updated_at) VALUES (1, 2, 'emailing_complaint', '{"complaint":{}}', $1, $1, $1)`, [t]);
  // carol : hard bounce sur l'envoi, statut changé par le scheduler media (pas d'historique)
  await q(`UPDATE email SET hard_bounced = true, updated_at = $1 WHERE contact_id = 3`, [t]);
  await q(`UPDATE contact SET email_status = 'hard_bounce', last_status_update = $1, updated_at = $1 WHERE id = 3`, [t]);
  // dave : désabonnement daté d'une heure, antérieur au dernier événement v2 déjà intégré (voir le test)
  await q(`UPDATE contact SET email_status = 'unsub', updated_at = $1 WHERE id = 4`, [iso(ago(0, 1))]);
  await q(`INSERT INTO contact_history (product_id, contact_id, type, date, created_at, updated_at) VALUES (1, 4, 'emailing_unsub', $1, $1, $1)`, [iso(ago(0, 1))]);
  // frank : se réinscrit sur le site (toujours servi par media) ; actif avant son désabonnement, il redevient workable
  await q(`UPDATE contact SET email_status = 'new', updated_at = $1 WHERE id = 5`, [t]);
  await q(`INSERT INTO inscription (contact_id, product_id, contact_source_id, inscripted_at, fields, source_name, email, is_new, created_at, updated_at) VALUES (5, 1, 1, $1, '{"optin":"oui"}', 'Formulaire site', 'frank@example.com', false, $1, $1)`, [t]);
  // gina : empreinte ajoutée à la blacklist media
  await q(`INSERT INTO blacklisted_contact (md5, created_at, updated_at) VALUES ($1, $2, $2)`, [md5('gina@example.com'), t]);
  // ivan : nouvel inscrit côté media (relais d'API pas encore actif)
  await q(`INSERT INTO contact (email, firstname, product_id, email_status, created_at, updated_at) VALUES ('ivan@example.com', 'Ivan', 1, 'new', $1, $1)`, [t]);
  await q(`INSERT INTO inscription (contact_id, product_id, contact_source_id, inscripted_at, fields, source_name, email, is_new, created_at, updated_at) VALUES (8, 1, 1, $1, '{}', 'Formulaire site', 'ivan@example.com', true, $1, $1)`, [t]);
};

const statuses = async () => {
  const result = {};
  for (const c of await sequelizeModule.get().models.Contact.findAll()) {
    result[c.email.split('@')[0]] = c.status;
  }
  return result;
};

beforeAll(async () => {
  const databaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emailing-pg-'));
  pg = await startEmbeddedPostgres({ databaseDir, persistent: false, quiet: true, databases: ['emailing_test', 'media_src'] });
  Object.assign(process.env, {
    RESOURCE_UID: 'test',
    DATABASE_URL: pg.databaseUrl(),
    JWT_SECRET: 'test-secret',
    PUBLIC_URL: 'https://emailing.example.com',
    API_PUBLIC_URL: 'https://emailing.example.com/api/test',
    FILES_PUBLIC_URL: 'https://emailing.example.com/files/test',
    LOG_LEVEL: 'WARN'
  });
  process.chdir(ROOT);
  sequelizeModule = require('../../src/storage/sequelize');
  const sequelize = await sequelizeModule.initWithPostgresql(5);
  const { syncModel } = require('../../src/storage/syncModel');
  await syncModel(sequelize);
  source = new Client({ connectionString: pg.databaseUrl('media_src') });
  await source.connect();
  await seedSource();
  media = require('../../src/migration/mediaDatabase');
  sync = require('../../src/migration/mediaStatusSync');
});

afterAll(async () => {
  await source.end();
  await sequelizeModule.close();
  await pg.stop();
});

test('reprise puis premier passage sans curseur : rattrapage complet sans doublon', async () => {
  const sequelize = sequelizeModule.get();
  const { ContactEvent, Contact } = sequelize.models;
  await media.migrateFromMedia({ sequelize, source, products: ['guide'] });
  const ContactStatusService = require('../../src/services/ContactStatusService');
  const service = new ContactStatusService();
  for (const c of await Contact.findAll()) {
    await service.updateContactStatus(c);
  }
  expect(await statuses()).toEqual({ alice: 'workable', bob: 'workable', carol: 'workable', dave: 'workable', frank: 'unsub', gina: 'workable' });
  const eventsBefore = await ContactEvent.count();

  const stats = await sync.syncStatusesFromMedia({ sequelize, source, products: ['guide'] });
  // sans curseur, tous les contacts media sont relus : déjà présents, ignorés
  expect(stats.newContacts).toMatchObject({ read: 6, existing: 6, created: 0 });
  expect(stats.history).toMatchObject({ read: 1, created: 0, existing: 1 });
  expect(stats.statuses).toMatchObject({ read: 1, created: 0, existing: 1 });
  expect(stats.inscriptions).toMatchObject({ read: 6, created: 0, existing: 6 });
  expect(stats.touched).toBe(0);
  expect(await ContactEvent.count()).toBe(eventsBefore);
  const cursor = await sync.getCursor(sequelize);
  expect(cursor.products.guide).toMatchObject({ historyId: 1, contactId: 6 });
  expect(cursor.products.guide.lastRunAt).toBeTruthy();
});

test('événements media après la bascule : simulation sans écriture', async () => {
  const sequelize = sequelizeModule.get();
  const { ContactEvent, ContactStatusService } = { ...sequelize.models, ContactStatusService: require('../../src/services/ContactStatusService') };
  // dave reçoit un envoi v2 il y a 20 minutes, intégré à son cache d'événements : son désabonnement media (il y a 1 h)
  // est antérieur au dernier événement intégré
  const dave = await sequelize.models.Contact.findOne({ where: { email: 'dave@example.com' } });
  await ContactEvent.create({ contactId: dave.id, type: 'request', date: ago(0, 1 / 3), requestDate: ago(0, 1 / 3), esp: 'unknown', inscriptionId: dave.lastInscriptionId });
  await new ContactStatusService().updateContactStatusWithId(dave.id);

  await mediaEventsAfterSwitch();
  const cursorBefore = await sync.getCursor(sequelize);
  const eventsBefore = await ContactEvent.count();
  const stats = await sync.syncStatusesFromMedia({ sequelize, source, products: ['guide'], dryRun: true });
  expect(stats.dryRun).toBe(true);
  expect(stats.touched).toBe(6);
  expect(await ContactEvent.count()).toBe(eventsBefore);
  expect(await sequelize.models.Contact.count({ where: { email: 'ivan@example.com' } })).toBe(0);
  expect(await sync.getCursor(sequelize)).toEqual(cursorBefore);
  expect(await statuses()).toMatchObject({ alice: 'workable', bob: 'workable', frank: 'unsub' });
});

test('désabonnement, plainte, hard bounce, réinscription, blacklist et nouveau contact rejoués dans la v2', async () => {
  const sequelize = sequelizeModule.get();
  const { Contact, ContactEvent, ContactInscription, BlacklistedContact } = sequelize.models;
  const stats = await sync.syncStatusesFromMedia({ sequelize, source, products: ['guide'] });
  expect(stats.newContacts).toMatchObject({ read: 1, created: 1 });
  // alice (unsub), bob (complaint), dave (unsub) ; l'autre produit n'est pas lu
  expect(stats.history).toMatchObject({ read: 3, created: 3, existing: 0 });
  // drapeau de l'envoi d'alice : même désabonnement que l'historique ; hard bounce de carol créé
  expect(stats.emailFlags).toMatchObject({ read: 2, created: 1, existing: 1 });
  // statuts : alice, bob, dave déjà couverts ; carol couverte par le drapeau ; ivan (new) et frank (new) pas concernés
  expect(stats.statuses).toMatchObject({ read: 4, created: 0, existing: 4 });
  expect(stats.inscriptions).toMatchObject({ created: 1 });
  expect(stats.blacklist).toMatchObject({ read: 1, created: 1 });
  expect(stats.touched).toBe(6);
  expect(stats.recalculated).toBe(6);

  expect(await statuses()).toEqual({ alice: 'unsub', bob: 'complaint', carol: 'hard_bounce', dave: 'unsub', frank: 'workable', gina: 'blacklisted', ivan: 'new' });
  const s = await statuses();
  expect(SENDABLE).not.toContain(s.alice);
  expect(SENDABLE).toContain(s.frank);

  const alice = await Contact.findOne({ where: { email: 'alice@example.com' } });
  const aliceUnsub = await ContactEvent.findAll({ where: { contactId: alice.id, type: 'unsub' } });
  expect(aliceUnsub).toHaveLength(1);
  expect(aliceUnsub[0].details).toMatchObject({ origin: 'link', media: { product: 'guide', kind: 'history', key: 'h:3' } });
  expect(alice.stats.unsub).toBe(1);

  // dave : l'événement est daté de la synchronisation (sinon le recalcul ne le relirait pas), date media conservée
  const dave = await Contact.findOne({ where: { email: 'dave@example.com' } });
  const [daveUnsub] = await ContactEvent.findAll({ where: { contactId: dave.id, type: 'unsub' } });
  expect(daveUnsub.date.getTime()).toBeGreaterThan(ago(0, 0.2).getTime());
  expect(Math.abs(new Date(daveUnsub.details.media.date) - ago(0, 1))).toBeLessThan(60000);

  const frank = await Contact.findOne({ where: { email: 'frank@example.com' } });
  const frankInscriptions = await ContactInscription.findAll({ where: { contactId: frank.id }, order: [['inscriptionDate', 'ASC']] });
  expect(frankInscriptions).toHaveLength(2);
  expect(frankInscriptions[1]).toMatchObject({ isFirst: false, sourceName: 'Formulaire site', fields: { optin: 'oui' } });
  expect(frank.lastInscriptionId).toBe(frankInscriptions[1].id);

  expect(await BlacklistedContact.count({ where: { md5: md5('gina@example.com') } })).toBe(1);
  const ivan = await Contact.findOne({ where: { email: 'ivan@example.com' } });
  expect(ivan.customFields.media).toEqual({ product: 'guide', id: 8 });
  expect(await Contact.count({ where: { email: 'other@example.com' } })).toBe(0);
});

test('idempotence : passage suivant et rattrapage complet ne recréent rien', async () => {
  const sequelize = sequelizeModule.get();
  const { ContactEvent, ContactInscription, BlacklistedContact, Contact } = sequelize.models;
  const counts = async () => [await ContactEvent.count(), await ContactInscription.count(), await BlacklistedContact.count(), await Contact.count()];
  const before = await counts();
  const statusesBefore = await statuses();

  const next = await sync.syncStatusesFromMedia({ sequelize, source, products: ['guide'] });
  expect(next.touched).toBe(0);
  expect(next.newContacts.created).toBe(0);
  expect(next.history.created + next.emailFlags.created + next.statuses.created + next.inscriptions.created + next.blacklist.created).toBe(0);

  const full = await sync.syncStatusesFromMedia({ sequelize, source, products: ['guide'], full: true });
  expect(full.touched).toBe(0);
  expect(full.history).toMatchObject({ read: 4, created: 0, existing: 4 });
  expect(full.inscriptions).toMatchObject({ read: 8, created: 0, existing: 8 });
  expect(await counts()).toEqual(before);
  expect(await statuses()).toEqual(statusesBefore);
});

test('job planifié sync_media_statuses : inactif sans MEDIA_STATUS_SYNC, puis rejoue un nouveau désabonnement', async () => {
  const sequelize = sequelizeModule.get();
  const { runJob, knownJobs } = require('../../src/jobs/runJob');
  expect(knownJobs).toContain('sync_media_statuses');
  const t = iso(new Date());
  await source.query(`UPDATE contact SET email_status = 'unsub', updated_at = $1 WHERE id = 5`, [t]);
  await source.query(`INSERT INTO contact_history (product_id, contact_id, type, date, created_at, updated_at) VALUES (1, 5, 'emailing_unsub', $1, $1, $1)`, [t]);

  delete process.env.MEDIA_STATUS_SYNC;
  await runJob('sync_media_statuses');
  expect((await statuses()).frank).toBe('workable');

  Object.assign(process.env, { MEDIA_STATUS_SYNC: '1', MEDIA_DATABASE_URL: pg.databaseUrl('media_src'), MEDIA_PRODUCTS: 'guide' });
  try {
    await runJob('sync_media_statuses');
  } finally {
    delete process.env.MEDIA_STATUS_SYNC;
    delete process.env.MEDIA_DATABASE_URL;
    delete process.env.MEDIA_PRODUCTS;
  }
  expect((await statuses()).frank).toBe('unsub');
  expect((await sync.getCursor(sequelize)).lastStats).toMatchObject({ touched: 1, history: 1 });
});
