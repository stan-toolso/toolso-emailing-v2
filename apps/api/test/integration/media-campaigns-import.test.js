/**
 * Import régulier des campagnes media (base ads → Content v2 actifs), sur PostgreSQL embarqué : règles de disponibilité
 * de media (statuts, annonceur, période, dates, plafond quotidien, produit, emplacement), utm résolus comme media,
 * paramètre de clic du partenaire, filtres d'audience et jours traduits, mises à jour, désactivations, contenus manuels
 * ou suspendus, rattachement aux planifications, simulation, job sans configuration, liens de désabonnement media du pied
 * de page DEM remplacés par {{{unsubLink}}} (contenus existants mis à jour au passage suivant).
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { Client } = require('pg');
const { startEmbeddedPostgres } = require('../lib/embedded-pg');

jest.setTimeout(180000);

const ROOT = path.join(__dirname, '..', '..');
const NOW = new Date('2026-11-23T10:00:00Z'); // lundi (day() = 1), 11 h à Paris
let pg;
let sequelizeModule;
let source;
let ads;
let campaigns;

const UTM_HTML =
  '<html><body><p>Bonjour {{contact.firstname}}</p><a href="https://ops.{{product.main_domain}}/lp/?utm_campaign={{campaign.id}}-{{ad_group.id}}-{{ad.id}}&utm_source={{product.uid}}&utm_medium=dem&e={{contact.email}}">Offre {{ad.name}}</a> <a href="{{{unsubLink}}}">désinscription</a></body></html>';

const seed = async () => {
  await source.query(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'media-schema.sql'), 'utf8'));
  await ads.query(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'ads-schema.sql'), 'utf8'));
  const q = (sql, params) => source.query(sql, params);
  await q(`INSERT INTO product (uid, name, main_domain, created_at, updated_at) VALUES ('site1', 'Site 1', 'site1.example.com', now(), now()), ('site2', 'Site 2', 'site2.example.com', now(), now())`);
  await q(`INSERT INTO settings (name, value, product_id) VALUES ('advertisers', '[{"id":1,"name":"Maison"}]', NULL), ('siteUrl', 'https://site1.example.com', 1)`);
  await q(`INSERT INTO email_content (name, product_id, type, is_active, archived, created_at, updated_at) VALUES ('DEM', 1, 'dem', true, false, now(), now())`);
  await q(
    `INSERT INTO email_content_version (name, email_content_id, settings, is_active, archived, created_at, updated_at) VALUES ('v1', 1, '{"header":"<div id=\\"hdr\\">H</div>"}', true, false, now(), now())`
  );

  const a = (sql, params) => ads.query(sql, params);
  await a(`INSERT INTO advertiser (name, created_at, updated_at) VALUES ('Maison', now(), now()), ('Externe', now(), now())`);
  await a(
    `INSERT INTO partner (name, ts_click_field, ts_click_value, created_at, updated_at) VALUES ('P sub', 'sub', '{{contact.id}}', now(), now()), ('P clic', 'source', 'tsclid_{{tsclid}}', now(), now())`
  );
  await a(`INSERT INTO campaign (name, enabled, public, advertiser_id, archived, created_at, updated_at) VALUES
    ('Interne', 'true', false, 1, false, now(), now()),
    ('Publique', 'true', true, 2, false, now(), now()),
    ('Privée externe', 'true', false, 2, false, now(), now())`);
  await a(`INSERT INTO ad_group (name, status, enabled, campaign_id, partner_id, advertiser_id, support_settings, distribution_settings, audience_settings, today_requests, created_at, updated_at) VALUES
    ('G1', 'active', true, 1, 1, 1, '{"productIds":[]}', NULL, NULL, 0, now(), now()),
    ('G2 autre site', 'active', true, 2, NULL, 2, '{"productIds":["2"]}', NULL, NULL, 0, now(), now()),
    ('G3 ciblé', 'active', true, 1, 2, 1, '{"productIds":["1"]}', '{"days":[1,2],"end":"2026-11-30","weight":3,"capping_requests":12000}', '{"type":"and","children":[{"type":"age","minAge":55},{"type":"esp","subType":"exclude","esps":["sfr"]}]}', 0, now(), now()),
    ('G4 terminé', 'active', true, 1, NULL, 1, NULL, '{"end":"2026-11-01"}', NULL, 0, now(), now()),
    ('G5 audience ou', 'active', true, 1, NULL, 1, NULL, NULL, '{"type":"or","children":[{"type":"age","minAge":18},{"type":"gender","gender":"F"}]}', 0, now(), now()),
    ('G6 privé externe', 'active', true, 3, NULL, 2, NULL, NULL, NULL, 0, now(), now()),
    ('G7 plafond', 'active', true, 1, NULL, 1, NULL, '{"daily_capping_requests":100}', NULL, 150, now(), now()),
    ('G8 période', 'active', true, 2, NULL, 2, NULL, '{"period":{"start":"12-01","end":"01-15"}}', NULL, 0, now(), now())`);
  const dem = (html) => JSON.stringify({ html, subject: 'Objet', sender_name: 'Exp', preview_text: 'Pré' });
  await a(
    `INSERT INTO ad (name, status, enabled, advertiser_id, ad_group_id, campaign_id, format, content, support_settings, created_at, updated_at) VALUES
    ('A1', 'active', 'true', 1, 1, 1, 'dem', $1, NULL, now(), now()),
    ('A2', 'active', 'true', 2, 2, 2, 'dem', $2, NULL, now(), now()),
    ('A3', 'learning', 'true', 1, 3, 1, 'dem', $1, NULL, now(), now()),
    ('A4', 'active', 'true', 1, 4, 1, 'dem', $2, NULL, now(), now()),
    ('A5', 'active', 'true', 1, 5, 1, 'dem', $2, NULL, now(), now()),
    ('A6', 'active', 'true', 2, 6, 3, 'dem', $2, NULL, now(), now()),
    ('A7', 'active', 'true', 1, 7, 1, 'dem', $2, NULL, now(), now()),
    ('A8', 'active', 'true', 2, 8, 2, 'dem', $2, NULL, now(), now()),
    ('A9', 'ad_disabled', 'false', 1, 1, 1, 'dem', $2, NULL, now(), now()),
    ('A10', 'active', 'true', 1, 1, 1, 'dem', $2, '{"slotNames":["native"]}', now(), now())`,
    [dem(UTM_HTML), dem('<p>x</p>')]
  );
};

beforeAll(async () => {
  const databaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emailing-pg-'));
  pg = await startEmbeddedPostgres({ databaseDir, persistent: false, quiet: true, databases: ['emailing_test', 'media_src', 'ads_src'] });
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
  ads = new Client({ connectionString: pg.databaseUrl('ads_src') });
  await ads.connect();
  await seed();
  campaigns = require('../../src/migration/mediaCampaigns');
});

afterAll(async () => {
  await source.end();
  await ads.end();
  await sequelizeModule.close();
  await pg.stop();
});

test('convertAudience et configFromEnv', () => {
  expect(
    campaigns.convertAudience({
      type: 'and',
      children: [
        { type: 'age', minAge: 25, maxAge: 60 },
        { type: 'gender', gender: 'F' },
        { type: 'zipcodePrefixes', subType: 'exclude', values: '75,92' },
        { type: 'esp', subType: 'include', esps: ['orange'] },
        { type: 'or', children: [{ type: 'dob', subType: 'birthday' }] },
        { type: 'contactField', field: 'custom', customField: 'pro', operator: '=', value: 'oui' }
      ]
    })
  ).toEqual({
    filters: [
      { type: 'age', minAge: 25, maxAge: 60 },
      { type: 'gender', gender: 'f' },
      { type: 'zipcodePrefixes', subType: 'exclude', values: '75,92' },
      { type: 'espInclude', esps: ['orange'] },
      { type: 'dob', subType: 'birthday' },
      { type: 'fieldValue', field: 'customFields', customField: 'pro', operator: '=', value: 'oui' }
    ],
    unsupported: []
  });
  expect(
    campaigns.convertAudience({
      type: 'and',
      children: [
        { type: 'email_status', email_status: 'active' },
        {
          type: 'or',
          children: [
            { type: 'age', minAge: 1 },
            { type: 'age', maxAge: 9 }
          ]
        }
      ]
    }).unsupported
  ).toEqual(['email_status', 'or']);
  expect(campaigns.convertAudience(null)).toEqual({ filters: [], unsupported: [] });
  expect(campaigns.configFromEnv({ MEDIA_DATABASE_URL: 'postgres://m', ADS_DATABASE_URL: 'postgres://a', MEDIA_PRODUCTS: 'site1, site2', MEDIA_CAMPAIGNS_SCHEDULES: 'none' })).toEqual({
    sourceUrl: 'postgres://m',
    adsUrl: 'postgres://a',
    products: ['site1', 'site2'],
    schedules: []
  });
  expect(campaigns.configFromEnv({ MEDIA_CAMPAIGNS_SCHEDULES: '3,4' }).schedules).toEqual([3, 4]);
  expect(() => campaigns.configFromEnv({ MEDIA_CAMPAIGNS_SCHEDULES: 'tous' })).toThrow(/MEDIA_CAMPAIGNS_SCHEDULES/);
  expect(campaigns.extractUtms('<a href="https://x/?a=1&amp;utm_campaign=1-2-3&utm_source=s">')).toEqual(['utm_campaign=1-2-3', 'utm_source=s']);
});

test('job sans source media configurée : ne fait rien', async () => {
  delete process.env.MEDIA_DATABASE_URL;
  delete process.env.ADS_DATABASE_URL;
  delete process.env.MEDIA_PRODUCTS;
  expect(await require('../../src/services/jobs/media_campaigns_import')()).toBeNull();
});

test('import, utm, filtres, puis synchronisation des changements de media', async () => {
  const sequelize = sequelizeModule.get();
  const { Content, ContentVersion, Schedule } = sequelize.models;

  const dry = await campaigns.importMediaCampaigns({ sequelize, source, ads, products: ['site1'], now: NOW, dryRun: true });
  expect(dry.contents.created).toBe(3);
  expect(await Content.count()).toBe(0);

  const stats = await campaigns.importMediaCampaigns({ sequelize, source, ads, products: ['site1'], now: NOW });
  expect(stats).toMatchObject({
    products: ['site1'],
    advertisers: 1,
    ads: { read: 9, targeting: 9, available: 2 },
    contents: { created: 3, updated: 0, deactivated: 0 },
    unavailable: { ended: 1, advertiser: 1, daily_capping: 1, period: 1, ad_disabled: 1, slot: 1, audience: 1 },
    unsupported: { capping_requests: 1, 'audience:or': 1 },
    tsClick: { applied: 1, skipped: 1 },
    schedules: { ids: [], linked: 0 }
  });
  expect(await Content.count()).toBe(3);
  expect(await sequelize.models.ContentSchedule.count()).toBe(0);

  // A1 : actif, utm résolus comme media, paramètre du partenaire, en-tête DEM du produit, balises v2 conservées
  const c1 = await Content.findOne({ where: { name: 'Interne – A1' } });
  expect(c1).toMatchObject({ isActive: true, type: 'marketing', category: 'Maison' });
  expect(c1.config.media).toMatchObject({ type: 'dem', id: 1, product: 'site1', campaignId: 1, adGroupId: 1, partner: 'P sub' });
  expect(c1.config.media.sync).toMatchObject({ available: true, reasons: [] });
  const v1 = await ContentVersion.findByPk(c1.defaultVersionId);
  expect(v1).toMatchObject({ subject: 'Objet', senderName: 'Exp', previewText: 'Pré' });
  expect(v1.html).toBe(
    '<html><body>\n<div id="hdr">H</div><p>Bonjour {{contact.firstname}}</p><a href="https://ops.site1.example.com/lp/?utm_campaign=1-1-1&utm_source=site1&utm_medium=dem&e={{contact.email}}&sub={{contact.id}}">Offre A1</a> <a href="{{{unsubLink}}}">désinscription</a></body></html>'
  );
  expect(campaigns.extractUtms(v1.html)).toEqual(['utm_campaign=1-1-1', 'utm_source=site1', 'utm_medium=dem']);

  // A3 : jours, audience, poids et fin traduits ; paramètre de clic dépendant de tsclid non ajouté
  const c3 = await Content.findOne({ where: { name: 'Interne – A3' } });
  expect(c3.isActive).toBe(true);
  expect(c3.config.filters).toEqual([
    { type: 'daysInclude', days: [1, 2] },
    { type: 'age', minAge: 55 },
    { type: 'espExclude', esps: ['sfr'] }
  ]);
  expect(c3.config.weight).toBe(3);
  expect(c3.endDate.toISOString()).toBe('2026-11-30T22:59:59.999Z');
  expect((await ContentVersion.findByPk(c3.defaultVersionId)).html).toContain('utm_campaign=1-3-3&utm_source=site1&utm_medium=dem&e={{contact.email}}"');

  // A5 : audience non traduisible → créé inactif
  const c5 = await Content.findOne({ where: { name: 'Interne – A5' } });
  expect(c5.isActive).toBe(false);
  expect(c5.config.media.sync).toMatchObject({ available: false, reasons: ['audience'], unsupported: ['audience:or'] });

  // relancé sans changement : rien ne bouge
  const same = await campaigns.importMediaCampaigns({ sequelize, source, ads, products: ['site1'], now: NOW });
  expect(same.contents).toMatchObject({ created: 0, updated: 0, activated: 0, deactivated: 0, unchanged: 3 });

  // changements dans media et dans la v2
  await ads.query(`UPDATE ad SET content = jsonb_set(content, '{subject}', '"Nouvel objet"') WHERE id = 1`);
  await ads.query(`UPDATE ad SET enabled = 'false', status = 'ad_disabled' WHERE id = 3`);
  await ads.query(`UPDATE campaign SET public = true WHERE id = 3`);
  await Content.update({ config: { ...c5.config, media: { ...c5.config.media, manual: true } } }, { where: { id: c5.id } });
  const schedule = await Schedule.create({ name: 'Créneau 9 h', status: 'waiting', isActive: false, uniqueContent: true, config: {} });

  const next = await campaigns.importMediaCampaigns({ sequelize, source, ads, products: ['site1'], now: NOW, schedules: [schedule.id] });
  expect(next.contents).toMatchObject({ created: 1, updated: 1, deactivated: 1, manual: 1 });
  expect((await ContentVersion.findByPk(c1.defaultVersionId)).subject).toBe('Nouvel objet');
  expect((await Content.findByPk(c3.id)).isActive).toBe(false);
  expect((await Content.findByPk(c3.id)).config.media.sync.reasons).toEqual(['ad_disabled']);
  const c6 = await Content.findOne({ where: { name: 'Privée externe – A6' } });
  expect(c6).toMatchObject({ isActive: true, category: 'Externe' });
  // rattachés à la planification : les contenus gérés par l'import (pas le contenu manuel)
  const linked = await sequelize.query('SELECT "contentId" FROM "ContentSchedule" WHERE "scheduleId" = :id ORDER BY 1', { replacements: { id: schedule.id }, type: sequelize.QueryTypes.SELECT });
  expect(linked.map((r) => r.contentId)).toEqual([c1.id, c3.id, c6.id].sort((x, y) => x - y));
  expect(next.schedules.linked).toBe(3);

  // contenu suspendu par la v2 : pas réactivé ; publicité supprimée de media : contenu désactivé
  await Content.update({ isActive: false, suspended: true }, { where: { id: c1.id } });
  await ads.query('DELETE FROM ad WHERE id = 6');
  const last = await campaigns.importMediaCampaigns({ sequelize, source, ads, products: ['site1'], now: NOW, schedules: [schedule.id] });
  expect(last.contents).toMatchObject({ suspended: 1, orphaned: 1, deactivated: 1, created: 0 });
  expect((await Content.findByPk(c1.id)).isActive).toBe(false);
  expect((await Content.findByPk(c6.id)).isActive).toBe(false);
  expect(last.schedules.linked).toBe(0);

  await expect(campaigns.importMediaCampaigns({ sequelize, source, ads, products: ['site1'], now: NOW, schedules: [9999] })).rejects.toThrow(/Planification/);
  await expect(campaigns.importMediaCampaigns({ sequelize, source, ads, products: ['inconnu'], now: NOW })).rejects.toThrow(/introuvable/);
});

test('mêmes campagnes pour un autre site, utm_source du site', async () => {
  const sequelize = sequelizeModule.get();
  const stats = await campaigns.importMediaCampaigns({ sequelize, source, ads, products: ['site2'], now: NOW, dryRun: true, samples: 10 });
  // site2 : pas de groupe réservé à site1 (G3), A2 (réservé à site2) disponible, A6 supprimée plus haut
  expect(stats.samples.find((s) => s.adId === 2)).toMatchObject({ active: true });
  expect(stats.samples.find((s) => s.adId === 1).utms).toEqual(['utm_campaign=1-1-1', 'utm_source=site2', 'utm_medium=dem']);
  expect(stats.ads.read).toBe(8);
});

test('lien de désabonnement media du pied de page DEM : remplacé par {{{unsubLink}}}, contenus existants mis à jour', async () => {
  const sequelize = sequelizeModule.get();
  const { Content, ContentVersion } = sequelize.models;
  await source.query(
    `UPDATE email_content_version SET settings = jsonb_set(settings, '{footer}', to_jsonb('<center><a href="https://unsubscribe.site1.example.com/?email={{contact.email}}" toolso:no-track toolso:unsub>Se désabonner</a></center>'::text)) WHERE email_content_id = 1`
  );
  const stats = await campaigns.importMediaCampaigns({ sequelize, source, ads, products: ['site1'], now: NOW });
  expect(stats.contents).toMatchObject({ created: 0, updated: 2 });
  expect(stats.unsubLinksReplaced).toBe(2);
  const rows = await sequelize.query(
    `SELECT c.name, v.html FROM "Content" c JOIN "ContentVersion" v ON v.id = c."defaultVersionId" WHERE c.config->'media'->>'type' = 'dem' AND NOT coalesce((c.config->'media'->>'manual')::boolean, false) ORDER BY c.id`,
    { type: sequelize.QueryTypes.SELECT }
  );
  expect(rows.length).toBe(3);
  for (const row of rows.filter((r) => r.name !== 'Privée externe – A6')) {
    expect(row.html).toContain('<center><a href="{{{unsubLink}}}" toolso:no-track toolso:unsub>Se désabonner</a></center>');
    expect(row.html).not.toContain('unsubscribe.site1');
  }
  const again = await campaigns.importMediaCampaigns({ sequelize, source, ads, products: ['site1'], now: NOW });
  expect(again.contents.updated).toBe(0);
});
