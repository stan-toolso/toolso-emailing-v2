const log = require('../../../util/log').getLogger('Schedule');

let _contactMessageRuleService = null;
module.exports = async (parent, { name }, context, info) => {
  if (!_contactMessageRuleService) {
    let ContactMessageRuleService = require('../../../services/ContactMessageRuleService');
    _contactMessageRuleService = new ContactMessageRuleService();
  }

  log.debug(`Create contact message rule ${name}`);
  return await _contactMessageRuleService.createContactMessageRule(name);
};
