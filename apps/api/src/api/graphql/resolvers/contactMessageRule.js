const log = require('../../../util/log').getLogger('contactMessageRule');

let _contactMessageRuleService = null;
module.exports = async (parent, { id }, context, info) => {
  if (!_contactMessageRuleService) {
    let ContactMessageRuleService = require('../../../services/ContactMessageRuleService');
    _contactMessageRuleService = new ContactMessageRuleService();
  }

  log.debug(`Get contact message rule ${id}`);

  return await _contactMessageRuleService.findWithId(id);
};
