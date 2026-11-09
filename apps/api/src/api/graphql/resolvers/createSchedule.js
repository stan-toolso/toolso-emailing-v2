let ScheduleService = require('../../../services/ScheduleService');
const log = require('../../../util/log').getLogger('Schedule');

let _scheduleService = null;
module.exports = async (parent, { name, type }, context, info) => {
  if (!_scheduleService) {
    _scheduleService = new ScheduleService();
  }

  log.debug(`Create schedule ${name}`);
  return await _scheduleService.createSchedule(name, type);
};
