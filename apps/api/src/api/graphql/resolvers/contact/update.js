let ContactService = require('../../../../services/ContactService');
const { Actions } = require('../../Actions');
const { checkActionPermission } = require('../../permissionFilter');
const log = require('../../../../util/log').getLogger('contact/update');

let _contactService = null;
module.exports = async (_parent, { contact }, context) => {
  if (!_contactService) {
    _contactService = new ContactService();
  }
  await checkActionPermission(Actions.Contacts.Update, context);
  if (contact?.id || contact?.email) {
    log.debug(`Update contact ${contact.id}`);
    return await _contactService.updateContact(contact);
  }
};
