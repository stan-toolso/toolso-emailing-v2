const log = require('../../../util/log').getLogger('blacklistedContacts');

let _blacklistedContactService = null;
module.exports = async (parent, { limit, offset, filter }, context, info) => {
  if (!_blacklistedContactService) {
    let BlacklistedContactService = require('../../../services/BlacklistedContactService');
    _blacklistedContactService = new BlacklistedContactService();
  }

  let filterToApply = !filter ? {} : { ...filter };
  log.debug(`Get blacklisted contacts with filter ${JSON.stringify(filterToApply)}`);

  if (parent && parent.id && parent.constructor.name == 'Contact') {
    filterToApply.contactId = parent.id;
  }

  return {
    limit,
    offset,
    filter: filterToApply,
    total: await _blacklistedContactService.countAll(filterToApply),
    blacklistedContacts: await _blacklistedContactService.findAll(offset, limit, filterToApply)
  };
};
