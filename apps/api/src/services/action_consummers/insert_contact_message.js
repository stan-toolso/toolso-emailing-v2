let _contactMessageService = null;
module.exports = async (payload) => {
  if (!_contactMessageService) {
    const ContactMessageService = require('../ContactMessageService');
    _contactMessageService = new ContactMessageService();
  }
  await _contactMessageService.createContactMessage(payload);
};
