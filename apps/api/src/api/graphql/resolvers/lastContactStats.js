let ContactStatsService = require('../../../services/ContactStatsService');
const log = require('../../../util/log').getLogger('lastContactStats');

let _contactStatsService = null;
module.exports = async () => {
  if (!_contactStatsService) {
    _contactStatsService = new ContactStatsService();
  }

  log.debug(`Get last contact stats`);

  return await _contactStatsService.getLastContactStats();
};
