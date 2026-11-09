const log = require('../../../util/log').getLogger('dimensionDelivStats');
const moment = require('moment-timezone');

let _contactEventStatsService = null;
module.exports = async (parent, { fromDate, toDate, dimensionType, filter, dimensionFields }) => {
  if (!_contactEventStatsService) {
    let ContactEventStatsService = require('../../../services/ContactEventStatsService');
    _contactEventStatsService = new ContactEventStatsService();
  }
  let filterToApply = !filter ? {} : { ...filter };
  if (parent && parent.constructor && parent.constructor.name == 'Content') {
    filterToApply['content'] = parent.id;
  } else if (parent && parent.constructor && parent.constructor.name == 'Schedule') {
    filterToApply['schedule'] = parent.parentId ? parent.parentId : parent.id;
    if (parent.type == 'single_send' || parent.type == 'recurrent_instance') {
      if (!fromDate) {
        fromDate = moment(parent.scheduleDate).format('YYYY-MM-DD');
      }
      if (!toDate) {
        toDate = moment(parent.scheduleDate).format('YYYY-MM-DD');
      }
    }
  }
  if (!fromDate || !toDate) {
    return {
      fromDate,
      toDate,
      filter: filterToApply,
      dimensionType,
      totalStats: {},
      dimensionsStats: []
    };
  }

  log.debug(`Get dimension deliv stats from ${fromDate} to ${toDate} with dimension  [${dimensionType}]. Filter : ${JSON.stringify(filterToApply)}`);

  const { totalStats, dimensionsStats } = await _contactEventStatsService.getDimensionStats(fromDate, toDate, dimensionType, filterToApply, dimensionFields);

  return {
    fromDate,
    toDate,
    filter: filterToApply,
    dimensionType,
    totalStats,
    dimensionsStats
  };
};
