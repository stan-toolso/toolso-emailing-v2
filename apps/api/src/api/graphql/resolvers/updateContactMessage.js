const log = require('../../../util/log').getLogger('updateContactMessage');

let _contactMessageService = null;
module.exports = async (parent, { message }, context, info) => {
  if (!_contactMessageService) {
    let ContactMessageService = require('../../../services/ContactMessageService');
    _contactMessageService = new ContactMessageService();
  }

  log.debug(`Update message ${message.id}`);
  return await _contactMessageService.updateMessage(message);
};
