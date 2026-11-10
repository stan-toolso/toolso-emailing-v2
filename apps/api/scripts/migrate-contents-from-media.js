#!/usr/bin/env node
/**
 * Reprend les contenus d'un produit toolso-media sous forme de Content v2 : articles (base media) et DEM (base ads).
 *   MEDIA_DATABASE_URL=postgres://… [ADS_DATABASE_URL=postgres://…] node scripts/migrate-contents-from-media.js --product <uid>
 *        [--articles-only | --dems-only] [--all-articles] [--since-days N] [--include-disabled] [--dry-run]
 * Sans ADS_DATABASE_URL, seuls les articles sont repris. Lit .env (DATABASE_URL, RESOURCE_UID). Idempotent
 * (Content.config.media identifie l'origine). Résumé JSON sur la sortie standard. Voir docs/06-migration-depuis-media.md.
 */
require('dotenv').config();
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'INFO';
const { parseArgs } = require('util');
const log = require('../src/util/log').getLogger('MigrateContentsFromMedia');

const usage = () => {
  console.error('Usage : MEDIA_DATABASE_URL=… [ADS_DATABASE_URL=…] node scripts/migrate-contents-from-media.js --product <uid>[,<uid>…] [--articles-only | --dems-only] [--all-articles] [--since-days N] [--include-disabled] [--dry-run]');
  process.exit(2);
};

let values;
try {
  ({ values } = parseArgs({
    options: {
      product: { type: 'string', multiple: true },
      'articles-only': { type: 'boolean', default: false },
      'dems-only': { type: 'boolean', default: false },
      'all-articles': { type: 'boolean', default: false },
      'since-days': { type: 'string', default: '0' },
      'include-disabled': { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', default: false }
    }
  }));
} catch (err) {
  console.error(err.message);
  usage();
}
if (values.help) {
  usage();
}
const sourceUrl = process.env.MEDIA_DATABASE_URL;
const adsUrl = process.env.ADS_DATABASE_URL;
if (!sourceUrl) {
  console.error('MEDIA_DATABASE_URL manquant (URL PostgreSQL de la base media).');
  usage();
}
if (values['articles-only'] && values['dems-only']) {
  usage();
}
const sinceDays = parseInt(values['since-days'], 10);
if (isNaN(sinceDays) || sinceDays < 0) {
  usage();
}
const products = (values.product ?? []).flatMap((p) => p.split(',')).map((p) => p.trim()).filter(Boolean);
const dems = values['dems-only'] ? true : values['articles-only'] ? false : !!adsUrl;
if (dems && !adsUrl) {
  console.error('ADS_DATABASE_URL manquant : les DEM sont dans la base ads (secret toolso-ads).');
  process.exit(2);
}
if (!dems && !values['articles-only'] && !adsUrl) {
  log.warn('ADS_DATABASE_URL absent : seuls les articles sont repris (pas de DEM).');
}

(async () => {
  const start = Date.now();
  const sequelizeModule = require('../src/storage/sequelize');
  try {
    const sequelize = await sequelizeModule.initWithPostgresql(5);
    const { migrateContentsFromMedia } = require('../src/migration/mediaContents');
    const stats = await migrateContentsFromMedia({
      sequelize,
      sourceUrl,
      adsUrl: dems ? adsUrl : null,
      products,
      articles: !values['dems-only'],
      dems,
      allArticles: values['all-articles'],
      sinceDays,
      includeDisabled: values['include-disabled'],
      dryRun: values['dry-run']
    });
    const total = await sequelize.models.Content.count();
    log.info(`${values['dry-run'] ? 'Simulation' : 'Reprise'} des contenus terminée en ${Math.round((Date.now() - start) / 1000)} s ; ${total} contenus en base`);
    console.log(JSON.stringify({ ...stats, contentsInTable: total }, null, 2));
    await sequelizeModule.close();
    process.exit(0);
  } catch (err) {
    log.error('Reprise des contenus depuis toolso-media échouée', err);
    await sequelizeModule.close().catch(() => {});
    process.exit(1);
  }
})();
