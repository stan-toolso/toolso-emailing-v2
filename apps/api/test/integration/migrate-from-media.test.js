/**
 * Reprise d'une base toolso-media dans la base de l'instance, sur PostgreSQL embarqué (deux bases : media_src avec le
 * sous-ensemble de schéma media de test/fixtures, emailing_test avec le schéma v2) : produits, inventaire, simulation,
 * contacts/inscriptions/événements/cache/blacklist/messages, événements de statut garantis, statut recalculé par la v2,
 * idempotence, reprise d'un second produit.
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { Client } = require('pg');
const { startEmbeddedPostgres } = require('../lib/embedded-pg');

jest.setTimeout(180000);

const ROOT = path.join(__dirname, '..', '..');
let pg;
let sequelizeModule;
let source;
let media;

const daysAgo = (n, hours = 10) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(hours, 0, 0, 0);
  return d;
};
const iso = (d) => d.toISOString();

const seedSource = async () => {
  await source.query(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'media-schema.sql'), 'utf8'));
  const q = (sql, params) => source.query(sql, params);
  await q(`INSERT INTO product (uid, name, disabled, created_at, updated_at) VALUES ('guide', 'Guide', false, now(), now()), ('autre', 'Autre média', true, now(), now())`);
  await q(`INSERT INTO contact_source (product_id, name, utm_source, api_key, api_enabled, api_fields, created_at, updated_at) VALUES
    (1, 'Formulaire site', 'site', 'key-1', true, '["email","firstname"]', now(), now()),
    (1, 'Partenaire', 'partner', NULL, false, NULL, now(), now()),
    (2, 'Formulaire site', 'site2', 'key-1', true, NULL, now(), now())`);
  // contacts du produit 1
  await q(
    `INSERT INTO contact (email, firstname, lastname, gender, dob, zipcode, city, country, product_id, fields, email_status, stats, scores, last_status_update, pixel_tracking_consent, created_at, updated_at) VALUES
    ('alice@example.com', 'Alice', 'Martin', 'F', '1980-05-04', '75001', 'Paris', 'FR', 1, '{"interest":"cuisine","email":"x"}', 'active', '{"emailing":{"request":20,"open":5,"click":1,"delivered":19}}', '{"emailing":{"activityScore":72.5,"openScore":3}}', NULL, true, '2024-01-10T09:00:00Z', '2025-10-01T09:00:00Z'),
    ('bob@example.com', 'Bob', NULL, 'm', NULL, NULL, NULL, NULL, 1, NULL, 'unsub', '{"emailing":{"request":3,"open":1,"unsub":1}}', NULL, '2025-09-15T08:00:00Z', NULL, '2025-09-01T09:00:00Z', '2025-09-15T08:00:00Z'),
    ('carol@example.com', 'Carol', NULL, NULL, '31/02/1980', NULL, NULL, NULL, 1, NULL, 'unsub', NULL, NULL, '2025-08-01T08:00:00Z', NULL, '2025-07-01T09:00:00Z', '2025-08-01T08:00:00Z'),
    ('dave@example.com', 'Dave', NULL, NULL, NULL, NULL, NULL, NULL, 1, NULL, 'new', NULL, NULL, NULL, NULL, '2025-10-20T09:00:00Z', '2025-10-20T09:00:00Z'),
    ('  INVALID ', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, NULL, 'new', NULL, NULL, NULL, NULL, now(), now()),
    ('Alice@Example.com', 'Alice2', NULL, NULL, NULL, NULL, NULL, NULL, 1, NULL, 'new', NULL, NULL, NULL, NULL, now(), now()),
    ('erin@example.com', 'Erin', NULL, NULL, NULL, NULL, NULL, NULL, 1, NULL, 'hard_bounce', '{"emailing":{"request":1,"hard_bounce":1}}', NULL, NULL, NULL, '2025-09-01T09:00:00Z', '2025-09-02T09:00:00Z'),
    ('frank@example.com', 'Frank', NULL, NULL, NULL, NULL, NULL, NULL, 1, NULL, 'active', '{"emailing":{"request":2}}', NULL, NULL, NULL, '2025-10-01T09:00:00Z', '2025-10-05T09:00:00Z'),
    ('grace@example.com', 'Grace', NULL, NULL, NULL, NULL, NULL, NULL, 1, NULL, 'contact_bounce', NULL, NULL, NULL, NULL, '2025-10-01T09:00:00Z', '2025-10-05T09:00:00Z')`
  );
  // contacts du produit 2 (hank nouveau, bob en doublon inter-produits)
  await q(`INSERT INTO contact (email, firstname, product_id, email_status, stats, created_at, updated_at) VALUES
    ('hank@example.com', 'Hank', 2, 'active', '{"emailing":{"request":4,"open":2}}', '2025-10-01T09:00:00Z', '2025-10-05T09:00:00Z'),
    ('bob@example.com', 'Bob', 2, 'active', NULL, '2025-10-01T09:00:00Z', '2025-10-05T09:00:00Z')`);
  // inscriptions : alice (3 dont deux le même jour), bob, carol, erin, frank, grace, hank ; dave n'en a aucune
  await q(`INSERT INTO inscription (contact_id, product_id, contact_source_id, inscripted_at, fields, source_name, email, is_new, collect_url, collect_ip, stats, created_at, updated_at) VALUES
    (1, 1, 1, '2024-01-10T09:00:00Z', '{"firstname":"Alice"}', 'Formulaire site', 'alice@example.com', true, 'https://guide.example.com/inscription', '1.2.3.4', '{"emailing":{"request":10,"open":2}}', '2024-01-10T09:00:00Z', '2024-01-10T09:00:00Z'),
    (1, 1, 2, '2025-10-01T07:00:00Z', '{}', 'Partenaire', 'alice@example.com', false, NULL, '5.6.7.8', NULL, '2025-10-01T07:00:00Z', '2025-10-01T07:00:00Z'),
    (1, 1, 2, '2025-10-01T09:00:00Z', '{}', 'Partenaire', 'alice@example.com', false, NULL, '5.6.7.8', NULL, '2025-10-01T09:00:00Z', '2025-10-01T09:00:00Z'),
    (2, 1, 1, '2025-09-01T09:00:00Z', '{}', 'Formulaire site', 'bob@example.com', true, NULL, NULL, NULL, '2025-09-01T09:00:00Z', '2025-09-01T09:00:00Z'),
    (3, 1, 1, '2025-09-01T09:00:00Z', '{}', 'Formulaire site', 'carol@example.com', true, NULL, NULL, NULL, '2025-09-01T09:00:00Z', '2025-09-01T09:00:00Z'),
    (7, 1, 1, '2025-09-01T09:00:00Z', '{}', 'Formulaire site', 'erin@example.com', true, NULL, NULL, NULL, '2025-09-01T09:00:00Z', '2025-09-01T09:00:00Z'),
    (8, 1, 1, '2025-10-01T09:00:00Z', '{}', 'Formulaire site', 'frank@example.com', true, NULL, NULL, NULL, '2025-10-01T09:00:00Z', '2025-10-01T09:00:00Z'),
    (9, 1, 1, '2025-10-01T09:00:00Z', '{}', 'Formulaire site', 'grace@example.com', true, NULL, NULL, NULL, '2025-10-01T09:00:00Z', '2025-10-01T09:00:00Z'),
    (10, 2, 3, '2025-10-01T09:00:00Z', '{}', 'Formulaire site', 'hank@example.com', true, NULL, NULL, NULL, '2025-10-01T09:00:00Z', '2025-10-01T09:00:00Z')`);
  // envois : alice 3 récents (un ouvert, un cliqué) + 1 ancien ; erin 1 hard bounce ; frank 1 récent
  await q(
    `INSERT INTO email (contact_id, product_id, message_id, sent_at, sent, opened, opened_at, clicked, hard_bounced, delivered, esp, created_at, updated_at) VALUES
    (1, 1, 'msg-a1', $1, true, true, $2, false, false, true, 'unknown', $1, $2),
    (1, 1, 'msg-a2', $3, true, true, $3, true, false, true, 'unknown', $3, $4),
    (1, 1, 'msg-a3', $5, true, false, NULL, false, false, true, 'unknown', $5, $5),
    (1, 1, 'msg-a0', $6, true, true, $6, false, false, true, 'unknown', $6, $6),
    (7, 1, 'msg-e1', $7, true, false, NULL, false, true, false, 'unknown', $7, $8),
    (8, 1, 'msg-f1', $5, true, false, NULL, false, false, true, 'unknown', $5, $5)`,
    [iso(daysAgo(20)), iso(daysAgo(20, 12)), iso(daysAgo(10)), iso(daysAgo(10, 11)), iso(daysAgo(2)), iso(daysAgo(200)), iso(daysAgo(40)), iso(daysAgo(40, 11))]
  );
  await q(`INSERT INTO contact_history (product_id, contact_id, type, details, date, created_at, updated_at) VALUES
    (1, 2, 'emailing_unsub', '{"origin":"link"}', '2025-09-15T08:00:00Z', '2025-09-15T08:00:00Z', '2025-09-15T08:00:00Z'),
    (1, 2, 'emailing_open', NULL, '2025-09-10T08:00:00Z', '2025-09-10T08:00:00Z', '2025-09-10T08:00:00Z')`);
  await q(`INSERT INTO blacklisted_contact (md5, sha1, sha256, history, created_at, updated_at) VALUES
    ('aaaa', 'bbbb', 'cccc', '{"blacklists":[{"origin":"admin","reason":"spamtrap","date":"2025-01-01T00:00:00Z"}]}', '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z'),
    ('dddd', 'eeee', 'ffff', NULL, '2025-02-01T00:00:00Z', '2025-02-01T00:00:00Z')`);
  await q(`INSERT INTO contact_message (contact_id, product_id, "from", "to", subject, text, received_at, status, sent, created_at, updated_at) VALUES
    (1, 1, 'alice@example.com', 'contact@guide.example.com', 'Question', 'Bonjour,  je voudrais…', '2025-10-02T10:00:00Z', 'pending', false, '2025-10-02T10:00:00Z', '2025-10-02T10:00:00Z'),
    (2, 1, 'bob@example.com', 'contact@guide.example.com', 'Stop', 'Arrêtez', '2025-09-14T10:00:00Z', 'pending', true, '2025-09-14T10:00:00Z', '2025-09-14T10:00:00Z')`);
  await q(`INSERT INTO email_sender (name, email, sender_name, product_id, router, created_at, updated_at) VALUES ('Guide', 'news@guide.example.com', 'Le Guide', 1, 'brevo', now(), now())`);
  await q(`INSERT INTO settings (name, value, product_id) VALUES ('timezone', 'Europe/Paris', NULL), ('emailingUnsubUrl', 'https://guide.example.com/unsub', 1)`);
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
});

afterAll(async () => {
  await source.end();
  await sequelizeModule.close();
  await pg.stop();
});

test('produits et inventaire', async () => {
  const products = await media.listProducts(source);
  expect(products.map((p) => [p.uid, p.contacts])).toEqual([
    ['guide', 9],
    ['autre', 2]
  ]);
  await expect(media.resolveProducts(source, [])).rejects.toThrow(/2 produits/);
  await expect(media.resolveProducts(source, ['inconnu'])).rejects.toThrow(/inconnu/);
  expect((await media.resolveProducts(source, ['guide', '1'])).map((p) => p.uid)).toEqual(['guide']);

  const inv = await media.inventory(source, await media.resolveProducts(source, ['guide']), { sinceDays: 90 });
  expect(inv.counts).toMatchObject({ contacts: 9, inscriptions: 8, contacts_without_inscription: 3, sources: 2, recent_emails: 5, status_history: 1, messages: 2, blacklisted: 2, contents: 0, templates: 0, sending_configs: 0, users: 0 });
  expect(inv.senders).toHaveLength(1);
  expect(inv.settings.map((s) => s.name)).toEqual(['timezone', 'emailingUnsubUrl']);
  expect(inv.contactsByStatus.find((r) => r.email_status === 'unsub').n).toBe(2);
});

test('simulation : comptages sans écriture', async () => {
  const sequelize = sequelizeModule.get();
  const stats = await media.migrateFromMedia({ sequelize, source, products: ['guide'], dryRun: true, batchSize: 10 });
  expect(stats.dryRun).toBe(true);
  // lot unique : le doublon de casse d'alice est détecté dans le lot
  expect(stats.contacts).toMatchObject({ read: 9, invalidEmail: 1, duplicates: 1, existing: 0, created: 7 });
  expect(await sequelize.models.Contact.count()).toBe(0);
  expect(await sequelize.models.ContactSource.count()).toBe(0);
  expect(await sequelize.models.BlacklistedContact.count()).toBe(0);
});

test('reprise du produit guide : contacts, inscriptions, événements, cache, blacklist, messages', async () => {
  const sequelize = sequelizeModule.get();
  const { Contact, ContactInscription, ContactSource, ContactEvent, ContactEvents, BlacklistedContact, ContactMessage } = sequelize.models;
  const stats = await media.migrateFromMedia({ sequelize, source, products: ['guide'], batchSize: 4, timezone: 'Europe/Paris' });
  expect(stats).toMatchObject({
    products: ['guide'],
    sources: { read: 2, created: 2, reused: 0, apiKeyConflicts: 0 },
    // lots de 4 : le doublon de casse d'alice (id 6) arrive après sa création, il est vu comme déjà présent
    contacts: { read: 9, invalidEmail: 1, duplicates: 0, existing: 1, created: 7, byStatus: { workable: 1, unsub: 2, new: 2, hard_bounce: 1, archived: 1 } },
    inscriptions: { read: 8, created: 9, synthesized: 1 },
    events: { guaranteed: 1 },
    blacklist: { read: 2, created: 2, updated: 0 },
    messages: { read: 2, created: 2 }
  });
  // alice : request ×3, open ×2, click ×1 ; bob : unsub (historique) ; carol : unsub garanti ; erin : request + hard_bounce ; frank : request
  expect(stats.events.created).toBe(11);
  expect(stats.eventCaches.created).toBe(5);

  const alice = await Contact.findOne({ where: { email: 'alice@example.com' } });
  expect(alice).toMatchObject({ firstname: 'Alice', lastname: 'Martin', gender: 'f', dob: '1980-05-04', zipcode: '75001', city: 'Paris', esp: 'unknown', status: 'workable', activated: true, blacklisted: false, pixelTrackingConsent: true, activityScore: 72.5, statusQueued: false, nextStatusUpdateDate: null });
  expect(alice.customFields).toEqual({ interest: 'cuisine', country: 'FR', media: { product: 'guide', id: 1 } });
  expect(alice.stats).toEqual({ request: 20, open: 5, click: 1, delivered: 19 });
  expect(alice.segment).toBeGreaterThanOrEqual(1);
  expect(alice.md5).toBe(require('md5')('alice@example.com'));
  expect(alice.createdAt.toISOString()).toBe('2024-01-10T09:00:00.000Z');
  expect(alice.lastRequestDate.toISOString()).toBe(daysAgo(2).toISOString());
  const aliceInscriptions = await ContactInscription.findAll({ where: { contactId: alice.id }, order: [['inscriptionDate', 'ASC']] });
  expect(aliceInscriptions.map((i) => [i.sourceName, i.isFirst, i.isFirstToday, i.activated, i.ip])).toEqual([
    ['Formulaire site', true, true, true, '1.2.3.4'],
    ['Partenaire', false, true, false, '5.6.7.8'],
    ['Partenaire', false, false, true, '5.6.7.8']
  ]);
  expect(aliceInscriptions[0].stats).toEqual({ request: 10, open: 2 });
  expect(aliceInscriptions[0].collectUrl).toBe('https://guide.example.com/inscription');
  expect(alice.lastInscriptionId).toBe(aliceInscriptions[2].id);
  const partner = await ContactSource.findOne({ where: { name: 'Partenaire' } });
  expect(alice.lastSourceId).toBe(partner.id);
  expect(aliceInscriptions[0].sourceId).toBe((await ContactSource.findOne({ where: { name: 'Formulaire site' } })).id);
  const aliceEvents = await ContactEvent.findAll({ where: { contactId: alice.id }, order: [['date', 'ASC']] });
  expect(aliceEvents.map((e) => e.type)).toEqual(['request', 'open', 'request', 'open', 'click', 'request']);
  expect(aliceEvents[0].messageId).toBe('msg-a1');
  expect(aliceEvents[1].date.toISOString()).toBe(daysAgo(20, 12).toISOString());
  expect(aliceEvents[1].requestDate.toISOString()).toBe(daysAgo(20).toISOString());
  expect(aliceEvents[1].isUnique).toBe(true);
  expect(aliceEvents[4].date.toISOString()).toBe(daysAgo(10, 11).toISOString());
  expect(aliceEvents.every((e) => e.inscriptionId === aliceInscriptions[2].id)).toBe(true);
  const aliceCache = await ContactEvents.findOne({ where: { contactId: alice.id } });
  expect(aliceCache.events).toHaveLength(6);
  expect(aliceCache.events[0].type).toBe('request');
  expect(new Date(aliceCache.events[0].date).toISOString()).toBe(daysAgo(2).toISOString());
  expect(Number(aliceCache.lastImportedId)).toBe(Math.max(...aliceEvents.map((e) => e.id)));
  expect(aliceCache.lastImportedDate.toISOString()).toBe(daysAgo(2).toISOString());

  const bob = await Contact.findOne({ where: { email: 'bob@example.com' } });
  expect(bob).toMatchObject({ status: 'unsub', activated: true, activityScore: 0, gender: 'm' });
  const bobEvents = await ContactEvent.findAll({ where: { contactId: bob.id } });
  expect(bobEvents.map((e) => [e.type, e.date.toISOString(), e.details])).toEqual([['unsub', '2025-09-15T08:00:00.000Z', { origin: 'link' }]]);

  const carol = await Contact.findOne({ where: { email: 'carol@example.com' } });
  expect(carol).toMatchObject({ status: 'unsub', dob: null });
  const carolEvents = await ContactEvent.findAll({ where: { contactId: carol.id } });
  // last_status_update (01/08) antérieur à la dernière inscription (01/09) : l'événement garanti est daté juste après l'inscription
  expect(carolEvents.map((e) => [e.type, e.date.toISOString()])).toEqual([['unsub', '2025-09-01T09:00:01.000Z']]);
  expect(carolEvents[0].details).toEqual({ origin: 'toolso-media', reason: 'email_status=unsub' });

  const dave = await Contact.findOne({ where: { email: 'dave@example.com' } });
  expect(dave).toMatchObject({ status: 'new', activated: false, stats: {} });
  const daveInscriptions = await ContactInscription.findAll({ where: { contactId: dave.id } });
  expect(daveInscriptions.map((i) => [i.sourceName, i.inscriptionDate.toISOString(), i.isFirst, i.fields])).toEqual([['toolso-media', '2025-10-20T09:00:00.000Z', true, {}]]);
  expect(dave.lastInscriptionId).toBe(daveInscriptions[0].id);

  const erin = await Contact.findOne({ where: { email: 'erin@example.com' } });
  expect(erin.status).toBe('hard_bounce');
  expect((await ContactEvent.findAll({ where: { contactId: erin.id }, order: [['date', 'ASC']] })).map((e) => e.type)).toEqual(['request', 'hard_bounce']);
  expect((await Contact.findOne({ where: { email: 'frank@example.com' } })).status).toBe('new');
  const grace = await Contact.findOne({ where: { email: 'grace@example.com' } });
  expect(grace.status).toBe('archived');
  expect(grace.statusDetail).toMatchObject({ reason: 'Too much contact bounce.' });
  expect(await Contact.count({ where: { email: 'hank@example.com' } })).toBe(0);

  const blacklist = await BlacklistedContact.findAll({ order: [['md5', 'ASC']] });
  expect(blacklist.map((b) => [b.md5, b.sha256, b.email])).toEqual([
    ['aaaa', 'cccc', null],
    ['dddd', 'ffff', null]
  ]);
  expect(blacklist[0].history.blacklists[0]).toMatchObject({ origin: 'admin', reason: 'spamtrap' });
  expect(blacklist[1].history.blacklists[0]).toMatchObject({ origin: 'toolso-media', reason: 'blacklisted_contact' });

  const messages = await ContactMessage.findAll({ order: [['date', 'ASC']] });
  expect(messages.map((m) => [m.contactId, m.title, m.status, m.extract])).toEqual([
    [bob.id, 'Stop', 'done', 'Arrêtez'],
    [alice.id, 'Question', 'pending', 'Bonjour, je voudrais…']
  ]);
});

test('la v2 conserve les statuts repris quand elle les recalcule', async () => {
  const sequelize = sequelizeModule.get();
  const { Contact } = sequelize.models;
  const ContactStatusService = require('../../src/services/ContactStatusService');
  const service = new ContactStatusService();
  for (const email of ['alice@example.com', 'bob@example.com', 'carol@example.com', 'erin@example.com']) {
    await service.updateContactStatus(await Contact.findOne({ where: { email } }));
  }
  const statuses = {};
  for (const c of await Contact.findAll({ where: { email: ['alice@example.com', 'bob@example.com', 'carol@example.com', 'erin@example.com'] } })) {
    statuses[c.email] = c.status;
  }
  expect(statuses).toEqual({ 'alice@example.com': 'workable', 'bob@example.com': 'unsub', 'carol@example.com': 'unsub', 'erin@example.com': 'hard_bounce' });
  const alice = await Contact.findOne({ where: { email: 'alice@example.com' } });
  // stats reprises non recomptées (le cache d'événements était déjà rempli)
  expect(alice.stats).toMatchObject({ request: 20, open: 5, click: 1 });
  expect(alice.nextStatusUpdateDate).not.toBeNull();
});

test('idempotence puis reprise d’un second produit (source réutilisée, doublon inter-produits ignoré)', async () => {
  const sequelize = sequelizeModule.get();
  const { Contact, ContactSource, BlacklistedContact } = sequelize.models;
  const again = await media.migrateFromMedia({ sequelize, source, products: ['guide'] });
  expect(again.contacts).toMatchObject({ created: 0, existing: 7 });
  expect(again.inscriptions.created).toBe(0);
  expect(again.events.created).toBe(0);
  expect(again.sources).toMatchObject({ created: 0, reused: 2 });
  expect(again.blacklist).toMatchObject({ created: 0, updated: 2 });
  expect(await BlacklistedContact.count()).toBe(2);

  const both = await media.migrateFromMedia({ sequelize, source, products: ['guide', 'autre'], skipBlacklist: true, skipMessages: true });
  expect(both.products).toEqual(['guide', 'autre']);
  expect(both.contacts).toMatchObject({ read: 11, created: 1, existing: 8 });
  expect(both.sources).toMatchObject({ read: 3, created: 0, reused: 3 });
  expect(both.blacklist.read).toBe(0);
  const hank = await Contact.findOne({ where: { email: 'hank@example.com' } });
  expect(hank.customFields.media).toEqual({ product: 'autre', id: 10 });
  expect(await ContactSource.count()).toBe(2);
  expect(await Contact.count()).toBe(8);
});
