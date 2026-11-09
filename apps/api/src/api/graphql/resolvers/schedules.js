let ScheduleService = require('../../../services/ScheduleService');
const log = require('../../../util/log').getLogger('Schedules');

let _scheduleService = null;
module.exports = async (parent, { offset, limit, filter }, context, info) => {
  if (!_scheduleService) {
    _scheduleService = new ScheduleService();
  }

  log.debug(`Get schedules `);

  return {
    offset: offset,
    limit: limit,
    filter: filter,
    total: await _scheduleService.countAll(filter),
    schedules: await _scheduleService.findAll(offset, limit, filter)
  };
};
