/**
 * Reprise des contenus toolso-media (articles de la base media, DEM de la base ads) en Content v2, sur PostgreSQL embarqué :
 * rendu Mustache partiel (renderKeeping), gabarit d'article, variables de contenu, DEM html et dem_template, filtres
 * (produit, désactivés, non publiés), simulation, idempotence, compilation par ContentService.
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
let ads;
let media;

const seed = async () => {
  await source.query(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'media-schema.sql'), 'utf8'));
  await ads.query(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'ads-schema.sql'), 'utf8'));
  const q = (sql, params) => source.query(sql, params);
  await q(`INSERT INTO product (uid, name, main_domain, created_at, updated_at) VALUES ('guide', 'Guide', 'guide.example.com', now(), now()), ('autre', 'Autre', NULL, now(), now())`);
  await q(`INSERT INTO settings (name, value, product_id) VALUES ('siteUrl', 'https://guide.example.com/', 1), ('imgBaseUrl', 'https://img.example.com', NULL), ('siteName', 'Le Guide', 1), ('timezone', 'Europe/Paris', NULL)`);
  await q(`INSERT INTO image (slug, product_id, title, created_at, updated_at) VALUES ('photo-1', 1, 'Photo', now(), now())`);
  await q(`INSERT INTO category (slug, name, created_at, updated_at) VALUES ('cuisine', 'Cuisine', now(), now()), ('vin', 'Vin', now(), now())`);
  await q(
    `INSERT INTO article (title, slug, content, description, short_description, status, product_id, published_at, featured_image_id, featured_image, cta_url, email_subject, customs, distribution_settings, created_at, updated_at) VALUES
    ('Dix recettes d''automne', 'dix-recettes', '<p>Le <b>contenu</b> complet, avec un <a href="https://x">lien</a>.</p>', '<p>Une description &amp; des recettes pour l''automne, à préparer sans attendre, pour toute la famille, avec des produits de saison et beaucoup de goût, encore et encore.</p>', 'Dix recettes faciles', 'published', 1, '2025-10-01T08:00:00Z', 1, NULL, 'https://guide.example.com/dix-recettes#cta', 'Nos 10 recettes', '{"auteur":"Alice"}', NULL, '2025-09-30T08:00:00Z', '2025-10-01T08:00:00Z'),
    ('Sans image', 'sans-image', '<p>Court.</p>', NULL, NULL, 'published', 1, '2025-10-02T08:00:00Z', NULL, '{"url":"https://cdn.example.com/legacy.jpg"}', NULL, NULL, NULL, '{"emailing_enabled":true}', '2025-10-02T08:00:00Z', '2025-10-02T08:00:00Z'),
    ('Brouillon', 'brouillon', '<p>…</p>', NULL, NULL, 'draft', 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, now(), now()),
    ('Exclu emailing', 'exclu', '<p>…</p>', NULL, NULL, 'published', 1, now(), NULL, NULL, NULL, NULL, NULL, '{"emailing_enabled":false}', now(), now()),
    ('Autre produit', 'autre-produit', '<p>…</p>', NULL, NULL, 'published', 2, now(), NULL, NULL, NULL, NULL, NULL, NULL, now(), now())`
  );
  await q(`INSERT INTO category_article (category_id, article_id, created_at, updated_at) VALUES (1, 1, '2025-10-01T08:00:00Z', now()), (2, 1, '2025-10-01T08:01:00Z', now())`);
  await q(`INSERT INTO email_content (name, product_id, type, is_active, archived, created_at, updated_at) VALUES ('DEM', 1, 'dem', true, false, now(), now()), ('DEM gabarit', 1, 'dem_template', true, false, now(), now()), ('Newsletter', 1, NULL, true, false, now(), now())`);
  await q(
    `INSERT INTO email_content_version (name, email_content_id, body, subject, preview_text, sender_name, settings, is_active, archived, created_at, updated_at) VALUES
    ('v1', 1, NULL, NULL, NULL, NULL, '{"header":"<div id=\\"hdr\\">H</div>","footer":"<div id=\\"ftr\\">F</div>"}', true, false, now(), now()),
    ('v1', 2, '<html><body><h1>{{ad.title}}</h1><a href="{{{ad.link}}}"><img src="{{{ad.image.src}}}"></a> Bonjour {{contact.firstname}} [ad name="auto"]</body></html>', 'Gabarit : {{ad.title}}', 'Gabarit PT', 'Le Guide', NULL, true, false, now(), now()),
    ('v1', 3, '<p>{{articles.0.title}}</p>', 'NL', NULL, NULL, NULL, true, false, now(), now())`
  );
  const a = (sql, params) => ads.query(sql, params);
  await a(`INSERT INTO advertiser (name, disabled, created_at, updated_at) VALUES ('Annonceur', false, now(), now())`);
  await a(`INSERT INTO partner (name, advertiser_id, ts_click_field, ts_click_value, created_at, updated_at) VALUES ('Partenaire', 1, 'sub', '{{contact.id}}', now(), now())`);
  await a(`INSERT INTO campaign (name, enabled, archived, public, advertiser_id, created_at, updated_at) VALUES ('Campagne A', 'true', false, false, 1, now(), now()), ('Campagne archivée', 'true', true, false, 1, now(), now())`);
  await a(`INSERT INTO ad_group (name, enabled, campaign_id, partner_id, advertiser_id, support_settings, created_at, updated_at) VALUES
    ('Groupe 1', true, 1, 1, 1, '{"productIds":["1"]}', now(), now()),
    ('Groupe autre produit', true, 1, NULL, 1, '{"productIds":[2]}', now(), now()),
    ('Groupe campagne archivée', true, 2, NULL, 1, '{}', now(), now())`);
  await a(
    `INSERT INTO ad (name, enabled, advertiser_id, ad_group_id, campaign_id, format, content, destination, created_at, updated_at) VALUES
    ('DEM html', 'true', 1, 1, 1, 'dem', '{"html":"<html><body><p>Bonjour {{contact.firstname}}, {{ad.content.title}} <a href=\\"{{ad.destination.url}}\\">go</a> [ad name=\\"x\\"] {{#now}}DD/MM{{/now}} {{contact.fields.ville}} {{tsclid}}__tsclid__</p></body></html>","title":"Titre A","subject":"Offre","sender_name":"Exp","preview_text":"Pré"}', '{"url":"https://adv.example.com/?e={{contact.email}}"}', now(), now()),
    ('DEM gabarit', 'true', 1, 1, 1, 'dem_template', '{"title":"Promo","image":{"url":"/ads/1/imgs/promo.webp"},"preview_text":"PT"}', '{"url":"https://adv.example.com/promo"}', now(), now()),
    ('DEM autre produit', 'true', 1, 2, 1, 'dem', '{"html":"<p>x</p>"}', NULL, now(), now()),
    ('DEM campagne archivée', 'true', 1, 3, 2, 'dem', '{"html":"<p>x</p>"}', NULL, now(), now()),
    ('Bannière', 'true', 1, 1, 1, 'banner', '{"title":"b"}', NULL, now(), now()),
    ('DEM désactivée', 'false', 1, 1, 1, 'dem', '{"html":"<p>x</p>"}', NULL, now(), now())`
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
  media = require('../../src/migration/mediaContents');
});

afterAll(async () => {
  await source.end();
  await ads.end();
  await sequelizeModule.close();
  await pg.stop();
});

test('renderKeeping : résout les variables fournies et conserve les autres balises', () => {
  const out = media.renderKeeping('A {{x}} {{{y}}} {{#s}}in {{x}}{{/s}} {{^n}}neg{{/n}} {{c.d.e}} {{#c}}{{d.e}}{{/c}} {{#now}}DD/MM{{/now}} {{o.p}}', { x: 'X', o: { p: 'P&' } });
  expect(out.html).toBe('A X {{{y}}} {{#s}}in X{{/s}}  {{c.d.e}} {{#c}}{{d.e}}{{/c}} {{#now}}DD/MM{{/now}} P&amp;');
  expect(out.kept.sort()).toEqual(['c', 'c.d.e', 'd.e', 'n', 'now', 's', 'y']);
  expect(out.droppedInverted).toEqual(['n']);
  expect(media.adaptToV2('{{contact.fields.ville}} {{#contact.fields.ok}}x{{/contact.fields.ok}} [ad name="a" formats="native"] __tsclid__').html).toBe('{{contact.customFields.ville}} {{#contact.customFields.ok}}x{{/contact.customFields.ok}}  ');
  expect(media.insertHeaderFooter('<html><body class="x"><p>a</p></body></html>', '<h>', '<f>')).toBe('<html><body class="x">\n<h><p>a</p><f>\n</body></html>');
  expect(media.insertHeaderFooter('<p>a</p>', '<h>', '<f>')).toBe('<h>\n<p>a</p>\n<f>');
  expect(media.resume('<p>Un <b>texte</b> &amp; des mots qui dépassent la taille.</p>', 12)).toBe('Un texte & des [..]');
});

test('simulation puis reprise des articles et des DEM du produit guide', async () => {
  const sequelize = sequelizeModule.get();
  const { Content, ContentVersion, ContentTemplate } = sequelize.models;
  const dry = await media.migrateContentsFromMedia({ sequelize, source, ads, products: ['guide'], dryRun: true });
  expect(dry.articles).toMatchObject({ read: 2, created: 2, existing: 0, withoutImage: 0 });
  expect(dry.dems).toMatchObject({ read: 5, otherProduct: 1, disabled: 2, created: 2, existing: 0, noTemplate: 0 });
  expect(await Content.count()).toBe(0);
  expect(await ContentTemplate.count()).toBe(0);

  const stats = await media.migrateContentsFromMedia({ sequelize, source, ads, products: ['guide'] });
  expect(stats).toMatchObject({
    products: ['guide'],
    templates: { created: 1, reused: 0 },
    articles: { read: 2, created: 2, existing: 0, withoutImage: 0 },
    dems: { read: 5, otherProduct: 1, disabled: 2, created: 2, adShortcodesRemoved: 2, droppedInverted: [] }
  });
  expect(stats.dems.keptTags).toMatchObject({ 'contact.firstname': 2, now: 1, 'contact.fields.ville': 1 });

  const template = await ContentTemplate.findOne({ where: { name: 'Article – Guide' } });
  expect(template.html).toContain('{{content.title}}');
  expect(template.previewText).toBe('{{content.preview_text}}');

  const recettes = await Content.findOne({ where: { name: "Dix recettes d'automne" } });
  expect(recettes).toMatchObject({ type: 'newsletter', isActive: false, category: 'Cuisine' });
  expect(recettes.config.media).toEqual({ type: 'article', id: 1, product: 'guide', publishedAt: '2025-10-01T08:00:00.000Z' });
  const version = await ContentVersion.findByPk(recettes.defaultVersionId);
  expect(version).toMatchObject({ isDefault: true, contentTemplateId: template.id, subject: 'Nos 10 recettes', previewText: 'Dix recettes faciles', html: '' });
  expect(version.templateVariables).toMatchObject({
    title: "Dix recettes d'automne",
    subject: 'Nos 10 recettes',
    link: 'https://guide.example.com/dix-recettes',
    cta_url: 'https://guide.example.com/dix-recettes#cta',
    image_url: 'https://img.example.com/imgs/max/photo-1.webp',
    image_w400: 'https://img.example.com/imgs/400x400/photo-1.webp',
    categories: ['Cuisine', 'Vin'],
    customs: { auteur: 'Alice' },
    site_url: 'https://guide.example.com',
    product_name: 'Le Guide',
    body: '<p>Le <b>contenu</b> complet, avec un <a href="https://x">lien</a>.</p>'
  });
  expect(version.templateVariables.short_resume).toBe('Une description & des recettes pour l\'automne, à préparer sans attendre, pour toute la famille, avec [..]');
  expect(version.templateVariables.long_resume.endsWith('encore et encore.')).toBe(true);

  const sansImage = await Content.findOne({ where: { name: 'Sans image' } });
  const sansImageVersion = await ContentVersion.findByPk(sansImage.defaultVersionId);
  expect(sansImageVersion.templateVariables).toMatchObject({ image_url: 'https://cdn.example.com/legacy.jpg', cta_url: 'https://guide.example.com/sans-image', subject: 'Sans image', preview_text: 'Court.', category: null });
  expect(await Content.count({ where: { name: ['Brouillon', 'Exclu emailing', 'Autre produit'] } })).toBe(0);

  // compilation par la v2 : gabarit + variables de contenu + variables d'envoi
  const ContentService = require('../../src/services/ContentService');
  const compiled = await new ContentService().compileContentVersion(recettes, version, { unsubLink: 'https://u.example.com/x', mirrorLink: 'https://m.example.com/y' }, true);
  expect(compiled.subject).toBe('Nos 10 recettes');
  expect(compiled.previewText).toBe('Dix recettes faciles');
  expect(compiled.html).toContain('>Dix recettes d&#39;automne</a>');
  expect(compiled.html).toContain('href="https://u.example.com/x"');
  expect(compiled.html).toContain('href="https://m.example.com/y"');
  expect(compiled.html).toContain('src="https://img.example.com/imgs/max/photo-1.webp"');
  expect(compiled.html).toContain('Le Guide');
  expect(compiled.html).not.toContain('{{');

  const demHtml = await Content.findOne({ where: { name: 'Campagne A – DEM html' } });
  expect(demHtml).toMatchObject({ type: 'marketing', isActive: false, category: 'Annonceur' });
  expect(demHtml.config.media).toMatchObject({ type: 'dem', id: 1, product: 'guide', format: 'dem', campaignId: 1, adGroupId: 1, partner: 'Partenaire', tsClick: { field: 'sub', value: '{{contact.id}}' } });
  const demHtmlVersion = await ContentVersion.findByPk(demHtml.defaultVersionId);
  expect(demHtmlVersion).toMatchObject({ subject: 'Offre', senderName: 'Exp', previewText: 'Pré', contentTemplateId: null });
  expect(demHtmlVersion.html).toBe('<html><body>\n<div id="hdr">H</div><p>Bonjour {{contact.firstname}}, Titre A <a href="https:&#x2F;&#x2F;adv.example.com&#x2F;?e&#x3D;{{contact.email}}">go</a>  {{#now}}DD/MM{{/now}} {{contact.customFields.ville}} </p><div id="ftr">F</div>\n</body></html>');

  const demTemplate = await Content.findOne({ where: { name: 'Campagne A – DEM gabarit' } });
  const demTemplateVersion = await ContentVersion.findByPk(demTemplate.defaultVersionId);
  expect(demTemplate.config.media).toMatchObject({ type: 'dem', id: 2, format: 'dem_template' });
  expect(demTemplateVersion).toMatchObject({ subject: 'Promo', previewText: 'PT', senderName: 'Le Guide' });
  expect(demTemplateVersion.html).toBe('<html><body><h1>Promo</h1><a href="https://adv.example.com/promo"><img src="https://guide.example.com/ads/1/imgs/promo.webp"></a> Bonjour {{contact.firstname}} </body></html>');

  // idempotence
  const again = await media.migrateContentsFromMedia({ sequelize, source, ads, products: ['guide'] });
  expect(again.templates).toEqual({ created: 0, reused: 1 });
  expect(again.articles).toMatchObject({ created: 0, existing: 2 });
  expect(again.dems).toMatchObject({ created: 0, existing: 2 });
  expect(await Content.count()).toBe(4);

  // articles seulement, tous statuts
  const all = await media.migrateContentsFromMedia({ sequelize, source, products: ['guide'], allArticles: true });
  expect(all.articles).toMatchObject({ read: 4, created: 2, existing: 2 });
  expect(all.dems.read).toBe(0);
  await expect(media.migrateContentsFromMedia({ sequelize, source, products: ['guide'], dems: true })).rejects.toThrow(/base ads/);
});
