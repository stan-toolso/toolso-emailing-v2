const InscriptionStatsService = require('../InscriptionStatsService');
const { getSettings } = require('../SettingsService');

let _inscriptionStatsService = null;

module.exports = async () => {
  if (!_inscriptionStatsService) {
    _inscriptionStatsService = new InscriptionStatsService();
  }
  const moment = require('moment-timezone');

  const { timezone } = await getSettings({ timezone: 'Europe/Paris' });

  await _inscriptionStatsService.updateInscriptionStats(moment().tz(timezone).add(-5, 'days'));
};
