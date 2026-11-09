const { Actions } = require('../Actions');
const { checkActionPermission } = require('../permissionFilter');

const log = require('../../../util/log').getLogger('contacts');

let _contactService = null;
module.exports = async (parent, { limit, offset, filter }, context, info) => {
  if (!_contactService) {
    let ContactService = require('../../../services/ContactService');
    _contactService = new ContactService();
  }
  await checkActionPermission(Actions.Contacts.List, context);

  log.debug(`Get contacts `);

  return {
    limit,
    offset,
    filter,
    total: await _contactService.countAll(filter),
    contacts: await _contactService.findAll(offset, limit, filter)
  };
};
