const ContactStatusService = require('../ContactStatusService');

let _contactStatusService = null;
const getContactStatusService = async () => {
  if (_contactStatusService) {
    return _contactStatusService;
  } else {
    _contactStatusService = new ContactStatusService();
    return _contactStatusService;
  }
};

module.exports = async (payload) => {
  await (await getContactStatusService()).updateContactStatusWithId(payload.contactId);
};
