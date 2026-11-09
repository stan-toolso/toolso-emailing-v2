const log = require('../../../util/log').getLogger('contactMessage');

let _contactMessageService = null;
module.exports = async (parent, { id }, context, info) => {
  if (!_contactMessageService) {
    let ContactMessageService = require('../../../services/ContactMessageService');
    _contactMessageService = new ContactMessageService();
  }

  log.debug(`Get contact message ${id}`);

  return await _contactMessageService.findWithId(id);
};
