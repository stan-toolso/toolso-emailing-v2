/**
 * Reprise de la configuration d'envoi toolso-media (expéditeurs → MailRouter + Sender sans identifiants, configurations
 * d'envoi → SendingConfig.espConfigs, créneaux → Schedule désactivés à heure fixe), sur PostgreSQL embarqué :
 * simulation, heures (media, option, défaut), maxDaySlots, inscription et sources, idempotence, identifiants.
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
let sequelize;
let source;
let sending;

const seed = async () => {
  await source.query(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'media-schema.sql'), 'utf8'));
  const q = (sql, params) => source.query(sql, params);
  await q(`INSERT INTO product (uid, name, created_at, updated_at) VALUES ('guide', 'Guide', now(), now()), ('autre', 'Autre', now(), now())`);
  await q(`INSERT INTO settings (name, value, product_id) VALUES ('timezone', 'Europe/Paris', NULL)`);
  await q(
    `INSERT INTO email_sender (name, email, sender_name, reply_to_name, reply_to_email, unsubscribe_mail_to, product_id, router, config, created_at, updated_at) VALUES
    ('Guide - Toolso', 'contact@news.guide.example.com', 'Guide', 'Guide', 'contact@news.guide.example.com', 'unsubscribe@news.guide.example.com', 1, 'toolso', '{"ip":"192.0.2.10","dns":"n1.mta.example.com","ip_bind":"10.0.0.5"}', now(), now()),
    ('Guide - Brevo', 'contact@news.guide.example.com', 'Guide', NULL, NULL, NULL, 1, 'brevo', '{"ip":"198.51.100.7","apikey":"SECRET-NE-DOIT-PAS-SORTIR"}', now(), now()),
    ('Guide - Inconnu', 'x@guide.example.com', 'Guide', NULL, NULL, NULL, 1, 'smtp', '{}', now(), now()),
    ('Autre - Brevo', 'contact@autre.example.com', 'Autre', NULL, NULL, NULL, 2, 'brevo', '{"apikey":"x"}', now(), now())`
  );
  await q(
    `INSERT INTO email_sending_config (product_id, name, config, created_at, updated_at) VALUES
    (1, 'Guide.fr', $1, now(), now()),
    (2, 'Autre', '{"espSenders":{"default":{"senders":[{"id":4,"weight":100}]}}}', now(), now())`,
    [
      JSON.stringify({
        espSenders: {
          gmail: { senders: [{ id: 1, weight: 100 }] },
          yahoo: { senders: [{ id: 2, weight: 100 }] },
          default: { senders: [{ id: 2, weight: 100 }] },
          orange: {
            senders: [
              { id: 1, weight: 70 },
              { id: 2, weight: 30 }
            ]
          },
          sfr: { senders: [{ id: 3, weight: 100 }] }
        },
        espScores: {
          gmail: { auto: true, minScore: 0.02, target_or: 18 },
          default: { auto: false, minScore: 0.01 },
          orange: { minScore: 0.5 }
        }
      })
    ]
  );
  await q(
    `INSERT INTO email_slot (name, product_id, type, settings, sending_config_id, is_active, created_at, updated_at) VALUES
    ('NL', 1, 'recurrent', '{"maxDaySlots":1}', 1, true, now(), now()),
    ('WM', 1, 'inscription', '{"delay_time":"00:10"}', 1, true, now(), now()),
    ('Double', 1, 'recurrent', '{"maxDaySlots":2}', 1, false, now(), now()),
    ('Fixe', 1, 'recurrent_schedule', '{"sending_time":"18:30","contactsFilter":{"type":"and"}}', 1, true, now(), now()),
    ('Manuel', 1, 'recurrent', '{"maxDaySlots":1,"sending_time_strategy":"manual","sending_time":"7:05"}', 1, true, now(), now()),
    ('NL autre', 2, 'recurrent', '{}', 2, true, now(), now())`
  );
  await q(`INSERT INTO email_content (name, product_id, type, is_active, archived, created_at, updated_at) VALUES ('Guide - DEM campaigns', 1, 'dem_campaigns', true, false, now(), now())`);
  await q(`INSERT INTO email_slot_content (email_content_id, email_slot_id, product_id, created_at, updated_at) VALUES (1, 1, 1, now(), now())`);
  await q(
    `INSERT INTO contact_source (product_id, name, email_slot_ids, default_email_slot_id, created_at, updated_at) VALUES (1, 'Formulaire', '[2]', NULL, now(), now()), (1, 'Sans WM', NULL, NULL, now(), now())`
  );
  await q(
    `INSERT INTO email (contact_id, product_id, sent_at, slot_id, created_at, updated_at) VALUES (1, 1, now() - interval '1 day', 1, now(), now()), (2, 1, now() - interval '2 days', 1, now(), now())`
  );
};

beforeAll(async () => {
  const databaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emailing-pg-'));
  pg = await startEmbeddedPostgres({ databaseDir, persistent: false, quiet: true, databases: ['emailing_test', 'media_src'] });
  Object.assign(process.env, {
    RESOURCE_UID: 'test',
    DATABASE_URL: pg.databaseUrl(),
    JWT_SECRET: 'test-secret',
    PUBLIC_URL: 'https://emailing.example.com',
    API_PUBLIC_URL: 'https://db1.example.com/api/test',
    FILES_PUBLIC_URL: 'https://db1.example.com/files/test',
    TRACKING_HOSTS: 'lk.guide.example.com',
    LOG_LEVEL: 'WARN'
  });
  process.chdir(ROOT);
  sequelizeModule = require('../../src/storage/sequelize');
  sequelize = await sequelizeModule.initWithPostgresql(5);
  const { syncModel } = require('../../src/storage/syncModel');
  await syncModel(sequelize);
  source = new Client({ connectionString: pg.databaseUrl('media_src') });
  await source.connect();
  await seed();
  await sequelize.models.ContactSource.create({ name: 'Formulaire', apiScheduleIds: null });
  sending = require('../../src/migration/mediaSending');
});

afterAll(async () => {
  await source.end();
  await sequelizeModule.close();
  await pg.stop();
});

describe('fonctions pures', () => {
  test('parseSlotTimes : global, par créneau, erreurs', () => {
    expect(sending.parseSlotTimes(['9:00,14:30', '12=20:00'])).toEqual({ default: ['09:00', '14:30'], bySlot: { 12: ['20:00'] } });
    expect(() => sending.parseSlotTimes(['25:00'])).toThrow(/--slot-time/);
    expect(() => sending.parseSlotTimes(['abc=10:00'])).toThrow(/--slot-time/);
  });

  test('slotTimesFor : heure media, défaut 9h + 3h, option', () => {
    expect(sending.slotTimesFor({ id: 1, type: 'recurrent_schedule', settings: { sending_time: '18:30' } })).toEqual({ times: ['18:30'], origin: 'media' });
    expect(sending.slotTimesFor({ id: 1, type: 'recurrent', settings: { maxDaySlots: 3 } })).toEqual({ times: ['09:00', '12:00', '15:00'], origin: 'default' });
    expect(sending.slotTimesFor({ id: 1, type: 'recurrent', settings: { sending_time: '07:00' } })).toEqual({ times: ['09:00'], origin: 'default' });
    expect(sending.slotTimesFor({ id: 1, type: 'recurrent', settings: {} }, sending.parseSlotTimes(['1=06:15']))).toEqual({ times: ['06:15'], origin: 'option' });
  });

  test('routerFor : toolso (endpoint Haraka, webhook) et brevo (IP, sans clé)', () => {
    const product = { uid: 'guide' };
    const toolso = sending.routerFor({ id: 1, name: 'T', router: 'toolso', config: { ip: '192.0.2.1', dns: 'n1.example.com', ip_bind: '10.0.0.1' } }, product, { apiPublicUrl: 'https://h/api/x/' });
    expect(toolso).toMatchObject({
      type: 'toolso',
      needsCredentials: false,
      config: { endpoint: 'http://n1.example.com:5000/sendRawEmail', ip: '192.0.2.1', ip_dns: 'n1.example.com', ip_bind: '10.0.0.1', webhookEndpoint: 'https://h/api/x/webhooks/toolso' }
    });
    const brevo = sending.routerFor({ id: 2, name: 'B', router: 'brevo', config: { ip: '198.51.100.7' } }, product, {});
    expect(brevo).toMatchObject({ type: 'sib', needsCredentials: true, config: { ips: [{ ip: '198.51.100.7', weight: 100 }] } });
    expect(JSON.stringify(brevo)).not.toMatch(/apikey/i);
    expect(sending.routerFor({ id: 3, router: 'smtp', config: {} }, product, {})).toBeNull();
  });

  test('convertSendingConfig : regroupe les ESP par expéditeurs, défaut en premier, scores', () => {
    const { espConfigs, warnings } = sending.convertSendingConfig(
      {
        espSenders: { gmail: { senders: [{ id: 1, weight: 100 }] }, yahoo: { senders: [{ id: 2 }] }, default: { senders: [{ id: 2, weight: 100 }] }, sfr: { senders: [{ id: 9 }] } },
        espScores: { gmail: { auto: true, minScore: 0.02, target_or: 18 }, default: { minScore: 0.01 } }
      },
      new Map([
        [1, 11],
        [2, 12]
      ])
    );
    expect(espConfigs).toEqual([
      {
        esps: ['yahoo'],
        default: true,
        senders: [
          { senderId: 12, weight: 100, minScoreByEsp: { default: 0.01, yahoo: 0.01 }, minNewScoreByEsp: {}, autoUpdates: { default: { enabled: false, minOpenRate: 19 }, yahoo: { enabled: false, minOpenRate: 19 } } }
        ]
      },
      { esps: ['gmail'], default: false, senders: [{ senderId: 11, weight: 100, minScoreByEsp: { gmail: 0.02 }, minNewScoreByEsp: {}, autoUpdates: { gmail: { enabled: true, minOpenRate: 18 } } }] }
    ]);
    expect(warnings).toHaveLength(1);
  });

  test('convertSendingConfig : un ESP avec un seuil media mais sans expéditeurs propres garde son seuil (groupe par défaut)', () => {
    const { espConfigs, warnings } = sending.convertSendingConfig(
      {
        espSenders: { default: { senders: [{ id: 2, weight: 100 }] }, gmail: { senders: [{ id: 1, weight: 100 }] } },
        espScores: {
          default: { minScore: 1 },
          gmail: { minScore: 51.06, minNewScore: 49.26, maxNewRequests: 1 },
          orange: { auto: true, minScore: 10.01, minNewScore: 1, maxNewRequests: 10, target_or: 18 },
          apple: { score: 'openScore', minScore: 0 },
          hotmail: { minScore: 5, maxNewRequests: 0 }
        }
      },
      new Map([
        [1, 11],
        [2, 12]
      ])
    );
    const def = espConfigs[0];
    expect(def.default).toBe(true);
    expect(def.esps).toEqual(['orange', 'apple', 'hotmail']);
    expect(def.senders[0].minScoreByEsp).toEqual({ default: 1, orange: 10.01, apple: 0, hotmail: 5 });
    expect(def.senders[0].minNewScoreByEsp).toEqual({ orange: 1, hotmail: 101 });
    expect(def.senders[0].autoUpdates.orange).toEqual({ enabled: true, minOpenRate: 18 });
    expect(espConfigs[1]).toMatchObject({ esps: ['gmail'], senders: [{ senderId: 11, minScoreByEsp: { gmail: 51.06 }, minNewScoreByEsp: { gmail: 49.26 } }] });
    expect(warnings.some((w) => w.includes('apple') && w.includes('openScore'))).toBe(true);
    expect(warnings.some((w) => w.includes('gmail') && w.includes('1 nouveaux'))).toBe(true);
  });
});

describe('reprise', () => {
  test('simulation : rien n’est écrit, plan et heures observées', async () => {
    const stats = await sending.migrateSendingFromMedia({ sequelize, source, products: ['guide'], dryRun: true });
    expect(stats.routers).toEqual({ created: 2, existing: 0, skipped: 1 });
    expect(stats.senders.created).toBe(2);
    expect(stats.sendingConfigs.created).toBe(1);
    // NL, WM, Double ×2, Fixe, Manuel
    expect(stats.schedules.created).toBe(6);
    const nl = stats.plan.schedules.find((s) => s.media === 1);
    expect(nl).toMatchObject({ time: '09:00', timeOrigin: 'default', contents: ['Guide - DEM campaigns'] });
    expect(nl.observedHours.reduce((a, h) => a + h.emails, 0)).toBe(2);
    expect(stats.credentialsToEnter).toEqual([expect.objectContaining({ type: 'sib', mediaHadApiKey: true })]);
    expect(JSON.stringify(stats)).not.toContain('SECRET-NE-DOIT-PAS-SORTIR');
    expect(await sequelize.models.MailRouter.count()).toBe(0);
    expect(await sequelize.models.Schedule.count()).toBe(0);
  });

  test('reprise réelle : routeurs sans identifiants, expéditeurs, configuration, planifications désactivées', async () => {
    const stats = await sending.migrateSendingFromMedia({ sequelize, source, products: ['guide'], slotTimes: ['3=08:00,20:00'] });
    expect(stats.warnings.join('\n')).toMatch(/smtp/);
    const { MailRouter, Sender, SendingConfig, Schedule, ContactSource } = sequelize.models;
    const routers = await MailRouter.findAll({ order: [['id', 'ASC']] });
    expect(routers.map((r) => r.type)).toEqual(['toolso', 'sib']);
    expect(routers.every((r) => !r.credentials)).toBe(true);
    expect(routers[0].config).toMatchObject({
      endpoint: 'http://n1.mta.example.com:5000/sendRawEmail',
      webhookEndpoint: 'https://db1.example.com/api/test/webhooks/toolso',
      media: { type: 'email_sender', id: 1, product: 'guide' }
    });
    const senders = await Sender.findAll({ order: [['id', 'ASC']] });
    expect(senders).toHaveLength(2);
    expect(senders[0]).toMatchObject({
      email: 'contact@news.guide.example.com',
      senderName: 'Guide',
      replyToEmail: 'contact@news.guide.example.com',
      unsubscribeMailto: 'unsubscribe@news.guide.example.com',
      trackingDomain: 'https://lk.guide.example.com',
      mailRouterId: routers[0].id
    });

    const [sc] = await SendingConfig.findAll();
    expect(sc.name).toBe('Guide.fr');
    const def = sc.config.espConfigs[0];
    expect(def).toMatchObject({ default: true, esps: ['yahoo'], senders: [{ senderId: senders[1].id, weight: 100 }] });
    const orange = sc.config.espConfigs.find((c) => c.esps.includes('orange'));
    expect(orange.senders.map((s) => [s.senderId, s.weight, s.minScoreByEsp.orange])).toEqual([
      [senders[0].id, 70, 0.5],
      [senders[1].id, 30, 0.5]
    ]);
    expect(sc.config.espConfigs.some((c) => c.esps.includes('sfr'))).toBe(false);

    const schedules = await Schedule.findAll({ order: [['id', 'ASC']] });
    expect(schedules.every((s) => s.isActive === false)).toBe(true);
    expect(schedules.every((s) => s.sendingConfigId === sc.id)).toBe(true);
    // heures dans le fuseau de l'instance (Europe/Paris)
    const moment = require('moment-timezone');
    const hours = schedules.map((s) => (s.scheduleDate ? moment(s.scheduleDate).tz('Europe/Paris').format('HH:mm') : null));
    expect(schedules.map((s) => [s.name, s.type, s.rate])).toEqual([
      ['NL', 'recurrent', 'day'],
      ['WM', 'inscription', null],
      ['Double 08:00', 'recurrent', 'day'],
      ['Double 20:00', 'recurrent', 'day'],
      ['Fixe', 'recurrent', 'day'],
      ['Manuel', 'recurrent', 'day']
    ]);
    expect(hours).toEqual(['09:00', null, '08:00', '20:00', '18:30', '07:05']);
    expect(schedules[1].uniqueContent).toBe(false);
    expect(stats.plan.schedules.map((s) => s.id)).toEqual(schedules.map((s) => s.id));
    expect(schedules[0].config.media).toMatchObject({ type: 'email_slot', id: 1, wasActive: true, index: 0 });

    const formulaire = await ContactSource.findOne({ where: { name: 'Formulaire' } });
    expect(formulaire.apiScheduleIds).toEqual([schedules[1].id]);
    expect(stats.warnings.join('\n')).toMatch(/filtre de contacts/);
    expect(stats.warnings.join('\n')).toMatch(/délai 00:10/);
  });

  test('relance : rien de nouveau, planifications laissées telles quelles', async () => {
    const { Schedule } = sequelize.models;
    await Schedule.update({ isActive: true }, { where: { name: 'NL' } });
    const stats = await sending.migrateSendingFromMedia({ sequelize, source, products: ['guide'], slotTimes: ['3=08:00,20:00'] });
    expect(stats.routers.created + stats.senders.created + stats.sendingConfigs.created + stats.schedules.created + stats.sourcesLinked).toBe(0);
    expect(stats.schedules.existing).toBe(6);
    expect(await Schedule.count()).toBe(6);
    expect((await Schedule.findOne({ where: { name: 'NL' } })).isActive).toBe(true);
  });

  test('set-mail-router-credentials : chiffre la clé lue sur stdin', async () => {
    const { execFileSync } = require('child_process');
    const router = await sequelize.models.MailRouter.findOne({ where: { type: 'sib' } });
    const out = execFileSync('node', ['scripts/set-mail-router-credentials.js', '--router-id', String(router.id)], { input: 'cle-de-test\n', env: process.env, encoding: 'utf8' });
    expect(out).toMatch(/apiKeyV3/);
    expect(out).not.toMatch(/cle-de-test/);
    await router.reload();
    const { decryptString } = require('../../src/services/SettingsService');
    expect(JSON.parse(await decryptString(router.credentials))).toEqual({ apiKeyV3: 'cle-de-test' });
  });
});
