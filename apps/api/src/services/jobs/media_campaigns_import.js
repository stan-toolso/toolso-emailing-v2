const log = require('../../util/log').getLogger('media_campaigns_import');

/**
 * Import des campagnes DEM de toolso-ads en contenus de l'instance (src/migration/mediaCampaigns.js), pendant la
 * transition depuis toolso-media. Ne fait rien sans source media (MEDIA_DATABASE_URL, ADS_DATABASE_URL, MEDIA_PRODUCTS
 * dans le .env de l'instance : deploy/bin/set-media-source.sh). MEDIA_CAMPAIGNS_SCHEDULES : none (défaut, aucun envoi)
 * ou identifiants des planifications auxquelles rattacher les contenus.
 */
module.exports = async ({ dryRun = false } = {}) => {
  const { importMediaCampaigns, configFromEnv } = require('../../migration/mediaCampaigns');
  const config = configFromEnv();
  if (!config.sourceUrl || !config.adsUrl || config.products.length === 0) {
    log.info('Source media non configurée (MEDIA_DATABASE_URL, ADS_DATABASE_URL, MEDIA_PRODUCTS) : import des campagnes ignoré');
    return null;
  }
  const sequelize = require('../../storage/sequelize').get();
  const stats = await importMediaCampaigns({ sequelize, ...config, dryRun });
  const { samples, ...summary } = stats;
  log.info(`Import des campagnes media ${dryRun ? '(simulation) ' : ''}: ${JSON.stringify(summary)}`);
  if (samples.length > 0) {
    log.debug(`Exemples : ${JSON.stringify(samples)}`);
  }
  return stats;
};
