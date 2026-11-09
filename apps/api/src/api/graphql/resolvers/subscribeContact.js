const log = require('../../../util/log').getLogger('contact');

let _contactService = null;
let _inscriptionService = null;
module.exports = async (parent, { id }, context, info) => {
  if (!_contactService) {
    const ContactService = require('../../../services/ContactService');
    const InscriptionService = require('../../../services/InscriptionService');

    _inscriptionService = new InscriptionService();
    _contactService = new ContactService();
  }

  log.debug(`Subscribe contact ${id}`);

  let contact = await _contactService.findWithId(id);
  if (contact) {
    await _inscriptionService.createContactInscription(contact.email, {}, context.ip, 'Toolso', 'Toolso Admin', []);
    contact = await _contactService.findWithId(id);
  }

  return contact;
};
