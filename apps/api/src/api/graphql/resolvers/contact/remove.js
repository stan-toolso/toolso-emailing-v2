let ContactService = require('../../../../services/ContactService');
const { Actions } = require('../../Actions');
const { checkActionPermission } = require('../../permissionFilter');
const log = require('../../../../util/log').getLogger('contact/remove');

let _contactService = null;
module.exports = async (parent, { id }, context, info) => {
  if (!_contactService) {
    _contactService = new ContactService();
  }

  log.debug(`Remove contact ${id}`);

  await checkActionPermission(Actions.Contacts.Delete, context);

  return await _contactService.removeContact(id);
};
