const log = require('../../../util/log').getLogger('Delete contact message rule');

let _contactMessageRuleService = null;
module.exports = async (parent, { contactMessageRuleId }, context, info) => {
  if (!_contactMessageRuleService) {
    let ContactMessageRuleService = require('../../../services/ContactMessageRuleService');
    _contactMessageRuleService = new ContactMessageRuleService();
  }

  log.debug(`Delete contact message rule ${contactMessageRuleId}`);
  return await _contactMessageRuleService.delete(contactMessageRuleId);
};
