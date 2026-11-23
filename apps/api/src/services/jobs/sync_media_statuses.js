const log = require('../../util/log').getLogger('sync_media_statuses');

/**
 * Transition depuis toolso-media : rejoue dans l'instance les désabonnements, plaintes, bounces, blacklist, réinscriptions
 * et nouveaux contacts survenus dans la base media des produits de l'instance (voir src/migration/mediaStatusSync.js et
 * docs/06-migration-depuis-media.md). Inactif sauf MEDIA_STATUS_SYNC=1 avec MEDIA_DATABASE_URL et MEDIA_PRODUCTS.
 */
module.exports = async () => {
  const { syncStatusesFromMedia, configFromEnv } = require('../../migration/mediaStatusSync');
  const config = configFromEnv();
  if (!config.enabled) {
    log.debug('MEDIA_STATUS_SYNC not enabled: media status sync skipped');
    return;
  }
  if (!config.sourceUrl || config.products.length === 0) {
    log.warn('MEDIA_STATUS_SYNC=1 but MEDIA_DATABASE_URL or MEDIA_PRODUCTS is missing: media status sync skipped');
    return;
  }
  const sequelize = require('../../storage/sequelize').get();
  const stats = await syncStatusesFromMedia({ sequelize, sourceUrl: config.sourceUrl, products: config.products, newContacts: config.newContacts });
  log.info(`Media status sync: ${JSON.stringify({ touched: stats.touched, recalculated: stats.recalculated, statusChanges: stats.statusChanges, history: stats.history, emailFlags: stats.emailFlags, statuses: stats.statuses, inscriptions: stats.inscriptions, blacklist: stats.blacklist, newContacts: stats.newContacts && stats.newContacts.created })}`);
};
