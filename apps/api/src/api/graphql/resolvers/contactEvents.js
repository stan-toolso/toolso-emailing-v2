const log = require('../../../util/log').getLogger('contactEvents');

let _contactEventService = null;
module.exports = async (parent, { limit, offset, filter }, context, info) => {
  if (!_contactEventService) {
    let ContactEventService = require('../../../services/ContactEventService');
    _contactEventService = new ContactEventService();
  }

  log.debug(`Get contact events `);
  let filterToApply = !filter ? {} : { ...filter };
  if (parent && parent.id && parent.constructor.name == 'Contact') {
    filterToApply.contactId = parent.id;
  }

  return {
    limit,
    offset,
    filter: filterToApply,
    total: await _contactEventService.countAll(filterToApply),
    events: await _contactEventService.findAll(offset, limit, filterToApply)
  };
};
