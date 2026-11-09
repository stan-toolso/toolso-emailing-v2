const ScheduleService = require('../ScheduleService');

let _scheduleService = null;

module.exports = async () => {
  if (!_scheduleService) {
    _scheduleService = new ScheduleService();
  }
  await _scheduleService.checkSentSchedules();
};
