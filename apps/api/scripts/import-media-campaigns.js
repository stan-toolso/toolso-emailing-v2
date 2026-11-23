#!/usr/bin/env node
/**
 * Import des campagnes DEM de toolso-ads en contenus de l'instance, comme le job media_campaigns_import du scheduler
 * (voir src/migration/mediaCampaigns.js et docs/06-migration-depuis-media.md § 7) :
 *
 *   node scripts/import-media-campaigns.js --dry-run     simulation (rien n'est écrit), compte rendu JSON
 *   node scripts/import-media-campaigns.js               import réel
 *
 * Source : MEDIA_DATABASE_URL, ADS_DATABASE_URL, MEDIA_PRODUCTS (et MEDIA_CAMPAIGNS_SCHEDULES) de l'environnement
 * (.env de l'instance, écrit par deploy/bin/set-media-source.sh). Options : --product <uid>[,<uid>…] (remplace
 * MEDIA_PRODUCTS), --samples N (contenus décrits, défaut 5).
 */
require('dotenv').config();
const log = require('../src/util/log').getLogger('ImportMediaCampaigns');

(async () => {
  const argv = process.argv.slice(2);
  const opt = (name) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const { importMediaCampaigns, configFromEnv } = require('../src/migration/mediaCampaigns');
  const config = configFromEnv();
  if (opt('--product')) {
    config.products = opt('--product')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (!config.sourceUrl || !config.adsUrl || config.products.length === 0) {
    console.error('Source media non configurée : MEDIA_DATABASE_URL, ADS_DATABASE_URL et MEDIA_PRODUCTS requis (deploy/bin/set-media-source.sh).');
    process.exit(2);
  }
  const sequelizeModule = require('../src/storage/sequelize');
  try {
    const sequelize = await sequelizeModule.initWithPostgresql(5);
    const stats = await importMediaCampaigns({ sequelize, ...config, dryRun: argv.includes('--dry-run'), samples: opt('--samples') ? parseInt(opt('--samples'), 10) : 5 });
    console.log(JSON.stringify(stats, null, 2));
    await sequelizeModule.close();
    process.exit(0);
  } catch (err) {
    log.error('Import des campagnes media en échec', err);
    process.exit(1);
  }
})();
