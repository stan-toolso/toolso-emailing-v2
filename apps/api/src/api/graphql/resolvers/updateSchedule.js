let ScheduleService = require('../../../services/ScheduleService');
const log = require('../../../util/log').getLogger('Update Schedule');

let _scheduleService = null;
module.exports = async (_parent, { schedule }, context) => {
  if (!_scheduleService) {
    _scheduleService = new ScheduleService();
  }

  log.debug(`Update schedule ${schedule.id}`);
  let email = context.token.email;
  return await _scheduleService.updateSchedule(schedule, email);
};
