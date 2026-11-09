const log = require('../../../util/log').getLogger('updateContactMessageRule');

let _contactMessageRuleService = null;
module.exports = async (parent, { contactMessageRule }, context, info) => {
  if (!_contactMessageRuleService) {
    let ContactMessageRuleService = require('../../../services/ContactMessageRuleService');
    _contactMessageRuleService = new ContactMessageRuleService();
  }

  log.debug(`Update contact message rule ${contactMessageRule.id}`);
  return await _contactMessageRuleService.update(contactMessageRule);
};
