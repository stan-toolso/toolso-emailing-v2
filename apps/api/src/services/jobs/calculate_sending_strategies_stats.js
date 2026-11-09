let _sendingStrategiesScheduleService = null;
const SendingStrategiesScheduleService = require('../SendingStrategiesScheduleService');

module.exports = async () => {
  const { getCachedSettings } = require('../SettingsService');
  const moment = require('moment-timezone');

  _sendingStrategiesScheduleService = new SendingStrategiesScheduleService();
  let { timezone } = await getCachedSettings(['timezone']);
  var todayDay = moment.tz(timezone).add(0, 'day');
  var yesterday = moment.tz(timezone).add(-1, 'day');
  var dayBeforeYesterday = moment.tz(timezone).add(-2, 'day');

  await _sendingStrategiesScheduleService.calculateAllSendingStrategiesStats(todayDay, false);
  await _sendingStrategiesScheduleService.calculateAllSendingStrategiesStats(yesterday, false);
  await _sendingStrategiesScheduleService.calculateAllSendingStrategiesStats(dayBeforeYesterday, false);
};
