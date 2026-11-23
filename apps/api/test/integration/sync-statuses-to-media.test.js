/**
 * Synchronisation inverse v2 → toolso-media (retour arrière), sur PostgreSQL embarqué : base media_src (sous-ensemble du
 * schéma media) et emailing_test (schéma v2) remplie par la reprise standard, puis événements nés dans la v2 après la bascule.
 * Vérifie le choix des événements (nés dans la v2, après la bascule, réinscriptions), le statut media jamais affaibli, la
 * simulation sans écriture, l'écriture (statut, historique, envois programmés supprimés), l'idempotence et la liste des
 * inscriptions à réimporter.
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
let reverse;

const daysAgo = (n) => new Date(Date.now() - n * 86400000);
const CUTOVER = daysAgo(5);

const seedSource = async () => {
  await source.query(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'media-schema.sql'), 'utf8'));
  const q = (sql, params) => source.query(sql, params);
  await q(`INSERT INTO product (uid, name, disabled, created_at, updated_at) VALUES ('guide', 'Guide', false, now(), now()), ('autre', 'Autre', false, now(), now())`);
  await q(`INSERT INTO contact_source (product_id, name, utm_source, created_at, updated_at) VALUES (1, 'Site', 'site', now(), now()), (2, 'Site', 'site', now(), now())`);
  const contacts = [
    ['alice@example.com', 1, 'active'],
    ['Bob@Example.com', 1, 'active'],
    ['carol@example.com', 1, 'unsub'],
    ['dave@example.com', 1, 'active'],
    ['erin@example.com', 1, 'complaint'],
    ['frank@example.com', 1, 'active'],
    ['gina@example.com', 1, 'new'],
    ['zoe@example.com', 2, 'active'],
    ['yann@example.com', 2, 'active']
  ];
  for (const [email, productId, status] of contacts) {
    const { rows } = await q(
      `INSERT INTO contact (email, product_id, email_status, stats, created_at, updated_at) VALUES ($1, $2, $3, '{"emailing":{"request":2,"open":1}}', now() - interval '200 days', now() - interval '100 days') RETURNING id`,
      [email, productId, status]
    );
    await q(`INSERT INTO inscription (contact_id, product_id, contact_source_id, inscripted_at, email, is_new, created_at, updated_at) VALUES ($1, $2, $2, now() - interval '200 days', $3, true, now(), now())`, [
      rows[0].id,
      productId,
      email
    ]);
  }
  // envoi programmé non parti d'alice (doit être supprimé), envoi passé (conservé)
  await q(`INSERT INTO email (contact_id, product_id, message_id, schedule_at, sent, done, created_at, updated_at) VALUES (1, 1, 'pending-a', now() + interval '1 day', false, false, now(), now()), (1, 1, 'sent-a', now() - interval '30 days', true, true, now(), now())`);
};

const v2Contact = async (email) => sequelizeModule.get().models.Contact.findOne({ where: { email } });
const addEvent = async (email, type, date, details = null) => {
  const contact = await v2Contact(email);
  await sequelizeModule.get().models.ContactEvent.create({ type, date, requestDate: date, esp: 'unknown', contactId: contact.id, details });
};
const mediaStatus = async (email, productId = 1) => (await source.query('SELECT email_status FROM contact WHERE lower(email) = $1 AND product_id = $2', [email, productId])).rows[0].email_status;

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
  reverse = require('../../src/migration/mediaReverseSync');
  // reprise standard des deux produits dans la même instance v2 (zoe et yann n'existent que dans « autre »)
  await media.migrateFromMedia({ sequelize, source, products: ['guide', 'autre'], batchSize: 10 });
  const { Contact, ContactInscription } = sequelize.models;

  // événements nés dans la v2 après la bascule
  await addEvent('alice@example.com', 'unsub', daysAgo(2), { origin: 'unsub_link' });
  await addEvent('bob@example.com', 'unsub', daysAgo(3));
  await addEvent('bob@example.com', 'hard_bounce', daysAgo(2), { bounceType: 'Permanent' });
  await addEvent('carol@example.com', 'complaint', daysAgo(1));
  await addEvent('erin@example.com', 'unsub', daysAgo(1));
  await addEvent('frank@example.com', 'unsub', daysAgo(3));
  await addEvent('zoe@example.com', 'unsub', daysAgo(1));
  // ignorés : rejoué depuis media par la synchronisation media → v2, antérieur à la bascule, repris
  await addEvent('dave@example.com', 'unsub', daysAgo(1), { media: { key: 'h:123' } });
  await addEvent('gina@example.com', 'unsub', daysAgo(10));
  await addEvent('gina@example.com', 'hard_bounce', daysAgo(1), { origin: 'toolso-media', reason: 'email_status=hard_bounce' });
  // frank s'est réinscrit après son désabonnement ; yann s'est inscrit après la bascule (contact de « autre »)
  for (const email of ['frank@example.com', 'yann@example.com']) {
    const c = await v2Contact(email);
    await ContactInscription.update({ inscriptionDate: daysAgo(1) }, { where: { id: c.lastInscriptionId } });
    await Contact.update({ status: 'workable' }, { where: { id: c.id } });
  }
});

afterAll(async () => {
  await source.end();
  await sequelizeModule.close();
  await pg.stop();
});

test('date de bascule obligatoire', async () => {
  await expect(reverse.syncStatusesToMedia({ sequelize: sequelizeModule.get(), source, products: ['guide'] })).rejects.toThrow(/bascule/);
});

test('simulation : plan sans écriture', async () => {
  const historyBefore = (await source.query('SELECT count(*)::int AS n FROM contact_history')).rows[0].n;
  const stats = await reverse.syncStatusesToMedia({ sequelize: sequelizeModule.get(), source, products: ['guide'], since: CUTOVER, batchSize: 2 });
  expect(stats.apply).toBe(false);
  expect(stats.contacts).toMatchObject({ candidates: 5, resubscribed: 1, noMediaContact: 1, alreadyBlocked: 1, toUpdate: 3, updated: 0 });
  expect(stats.byStatus).toEqual({ unsub: 1, hard_bounce: 1, complaint: 1 });
  expect(stats.inscriptions).toMatchObject({ sendableSinceCutover: 2, missingInMedia: 1 });
  expect(await mediaStatus('alice@example.com')).toBe('active');
  expect((await source.query('SELECT count(*)::int AS n FROM contact_history')).rows[0].n).toBe(historyBefore);
});

test('écriture : statut, historique, envois programmés', async () => {
  const stats = await reverse.syncStatusesToMedia({ sequelize: sequelizeModule.get(), source, products: ['guide'], since: CUTOVER, apply: true, instance: 'test' });
  expect(stats.contacts).toMatchObject({ toUpdate: 3, updated: 3, conflicts: 0, scheduledEmailsDeleted: 1 });
  expect(await mediaStatus('alice@example.com')).toBe('unsub');
  expect(await mediaStatus('bob@example.com')).toBe('hard_bounce');
  expect(await mediaStatus('carol@example.com')).toBe('complaint');
  expect(await mediaStatus('erin@example.com')).toBe('complaint');
  expect(await mediaStatus('frank@example.com')).toBe('active');
  expect(await mediaStatus('dave@example.com')).toBe('active');
  expect(await mediaStatus('gina@example.com')).toBe('new');
  expect(await mediaStatus('zoe@example.com', 2)).toBe('active');
  const { rows: history } = await source.query(`SELECT c.email, h.type, h.details FROM contact_history h JOIN contact c ON c.id = h.contact_id ORDER BY h.id`);
  expect(history.map((h) => [h.email.toLowerCase(), h.type])).toEqual([
    ['alice@example.com', 'emailing_unsub'],
    ['bob@example.com', 'emailing_hard_bounce'],
    ['carol@example.com', 'emailing_complaint']
  ]);
  expect(history[2].details).toMatchObject({ origin: 'toolso-emailing-v2', instance: 'test', previousStatus: 'unsub' });
  expect((await source.query(`SELECT message_id FROM email WHERE contact_id = 1 ORDER BY id`)).rows.map((r) => r.message_id)).toEqual(['sent-a']);
});

test('relance sans doublon', async () => {
  const stats = await reverse.syncStatusesToMedia({ sequelize: sequelizeModule.get(), source, products: ['guide'], since: CUTOVER, apply: true });
  expect(stats.contacts).toMatchObject({ toUpdate: 0, updated: 0, alreadyBlocked: 4 });
  expect((await source.query('SELECT count(*)::int AS n FROM contact_history')).rows[0].n).toBe(3);
});

test('inscriptions v2 depuis la bascule, à réimporter dans media', async () => {
  const rows = await reverse.listInscriptions({ sequelize: sequelizeModule.get(), source, productIds: [1], since: CUTOVER });
  expect(rows.map((r) => [r.email, r.mediaStatus]).sort()).toEqual([
    ['frank@example.com', 'active'],
    ['yann@example.com', null]
  ]);
});
