const log = require('../../../util/log').getLogger('contactMessages');

let _contactMessageService = null;
module.exports = async (parent, { limit, offset, filter }, context, info) => {
  if (!_contactMessageService) {
    let ContactMessageService = require('../../../services/ContactMessageService');
    _contactMessageService = new ContactMessageService();
  }

  let filterToApply = !filter ? {} : { ...filter };
  log.debug(`Get Contact messages with filter ${JSON.stringify(filterToApply)}`);
  if (parent && parent.id && parent.constructor.name == 'Contact') {
    filterToApply.contactId = parent.id;
  }

  return {
    limit,
    offset,
    filter: filterToApply,
    total: await _contactMessageService.countAll(filterToApply),
    messages: await _contactMessageService.findAll(offset, limit, filterToApply)
  };
};
