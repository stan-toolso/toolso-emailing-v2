let ContactStatsService = require('../../../services/ContactStatsService');
const log = require('../../../util/log').getLogger('lastContactStats');

let _contactStatsService = null;
module.exports = async (parent, { fromDate, toDate }, context, info) => {
  if (!_contactStatsService) {
    _contactStatsService = new ContactStatsService();
  }

  log.debug(`Get contact stats form ${fromDate} to ${toDate}`);

  return await _contactStatsService.getContactStats(fromDate, toDate);
};
