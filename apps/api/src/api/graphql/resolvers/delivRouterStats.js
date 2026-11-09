const log = require('../../../util/log').getLogger('dimensionRouters');
const moment = require('moment-timezone');
var contactEventStatsAggregateService;

module.exports = async (parent, { fromDate, toDate }) => {
  if (!contactEventStatsAggregateService) {
    let ContactEventStatsAggregateService = require('../../../services/ContactEventStatsAggregateService');
    contactEventStatsAggregateService = new ContactEventStatsAggregateService();
  }
  if (!fromDate) {
    fromDate = moment().startOf('month').format('YYYY-MM-DD');
  }

  if (!toDate) {
    toDate = moment().endOf('month').format('YYYY-MM-DD');
  }

  log.debug(`Get deliv Router stats from ${fromDate} to ${toDate}`);

  const delivRoutersStats = await contactEventStatsAggregateService.getDelivRoutersStats(fromDate, toDate);

  return {
    fromDate,
    toDate,
    delivRoutersStats
  };
};
