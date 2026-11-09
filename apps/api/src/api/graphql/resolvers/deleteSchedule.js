let ScheduleService = require('../../../services/ScheduleService');
const log = require('../../../util/log').getLogger('Delete Schedule');

let _scheduleService = null;
module.exports = async (parent, { scheduleId }, context, info) => {
  if (!_scheduleService) {
    _scheduleService = new ScheduleService();
  }

  log.debug(`Delete schedule ${scheduleId}`);
  return await _scheduleService.delete(scheduleId);
};
