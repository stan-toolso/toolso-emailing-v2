const ContactStatsService = require('../ContactStatsService');

let _contactStatsService = null;

module.exports = async () => {
  if (!_contactStatsService) {
    _contactStatsService = new ContactStatsService();
  }
  await _contactStatsService.updateContactStats();
};
