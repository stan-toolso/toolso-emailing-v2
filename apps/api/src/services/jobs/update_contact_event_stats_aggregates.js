let _service = null;

var MAX_DURATION = 4 * 60 * 1000;

module.exports = async () => {
  if (!_service) {
    const ContactEventStatsService = require('../ContactEventStatsService');
    _service = new ContactEventStatsService();
  }
  await _service.aggregateAllStats(MAX_DURATION);
};
