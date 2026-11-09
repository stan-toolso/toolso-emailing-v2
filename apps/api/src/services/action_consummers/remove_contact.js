const ContactService = require('../ContactService');

let _contactService = null;
const getContactService = async () => {
  if (_contactService) {
    return _contactService;
  } else {
    _contactService = new ContactService();
    return _contactService;
  }
};

module.exports = async (payload) => {
  await (await getContactService()).removeContact(payload.contactId);
};
