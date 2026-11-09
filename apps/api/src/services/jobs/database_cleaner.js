const log = require('../../util/log').getLogger('database_cleaner');

module.exports = async () => {
  const ContentService = require('../ContentService');
  await new ContentService().disableOldContents();

  // Instance autonome : purges qui étaient assurées par le TTL DynamoDB et les règles de cycle de vie S3.
  try {
    const MirrorService = require('../MirrorService');
    await new MirrorService().purgeExpired();
  } catch (err) {
    log.error('Failed to purge expired mirrors', err);
  }
  try {
    const { purgeOldFiles } = require('../FileStorageService');
    await purgeOldFiles();
  } catch (err) {
    log.error('Failed to purge old files', err);
  }
  try {
    const ActionService = require('../ActionService');
    await new ActionService().purgeFailed(30);
  } catch (err) {
    log.error('Failed to purge failed actions', err);
  }
};
