const log = require('../../../util/log').getLogger('contactMessages');

let _contactMessageRuleService = null;
module.exports = async (parent, { limit, offset, filter }, context, info) => {
  if (!_contactMessageRuleService) {
    let ContactMessageRuleService = require('../../../services/ContactMessageRuleService');
    _contactMessageRuleService = new ContactMessageRuleService();
  }

  log.debug(`Get Contact message rules with filter ${JSON.stringify(filter)}`);
  if (!filter) {
    filter = {};
  }

  return {
    limit,
    offset,
    filter,
    total: await _contactMessageRuleService.countAll(filter),
    rules: await _contactMessageRuleService.findAll(offset, limit, filter)
  };
};
