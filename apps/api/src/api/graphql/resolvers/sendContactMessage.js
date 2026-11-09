const log = require('../../../util/log').getLogger('updateContactMessage');

let _contactMessageService = null;
module.exports = async (parent, { emails, subject, senderName, templateVariables, sendingConfigId, html }, context, info) => {
  if (!_contactMessageService) {
    let ContactMessageService = require('../../../services/ContactMessageService');
    _contactMessageService = new ContactMessageService();
  }

  log.debug(`Send message to ${JSON.stringify(emails)}`);
  return await _contactMessageService.sendMessage(emails, subject, senderName, html, templateVariables, sendingConfigId, context.token.email);
};
