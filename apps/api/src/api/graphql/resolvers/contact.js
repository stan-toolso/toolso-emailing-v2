let ContactService = require('../../../services/ContactService');
const { Actions } = require('../Actions');
const { checkActionPermission } = require('../permissionFilter');
const log = require('../../../util/log').getLogger('contact');

let _contactService = null;
module.exports = async (parent, { id }, context, info) => {
  if (!_contactService) {
    _contactService = new ContactService();
  }

  await checkActionPermission(Actions.Contacts.Get, context);

  log.debug(`Get contact ${id}`);

  return await _contactService.findWithId(id);
};
