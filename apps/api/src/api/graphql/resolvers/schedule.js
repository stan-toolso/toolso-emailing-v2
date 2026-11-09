let ScheduleService = require('../../../services/ScheduleService');
const log = require('../../../util/log').getLogger('Schedule');

let _scheduleService = null;
module.exports = async (parent, { id }, context, info) => {
  if (!_scheduleService) {
    _scheduleService = new ScheduleService();
  }

  log.debug(`Get schedule ${id}`);
  return await _scheduleService.findWithId(id);
};
