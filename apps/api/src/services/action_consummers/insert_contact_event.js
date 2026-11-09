const ContactEventService = require('../ContactEventService');

let _contactEventService = null;
const getContactEventService = async () => {
  if (_contactEventService) {
    return _contactEventService;
  } else {
    _contactEventService = new ContactEventService();
    return _contactEventService;
  }
};

module.exports = async (payload) => {
  let contactEventService = await getContactEventService();
  if (payload.mirrorId && !payload.messageId) {
    payload.messageId = await contactEventService.getMessageIdFromMirrorId(payload.mirrorId);
  }

  await contactEventService.insertNewEvent(
    payload.email,
    payload.eventType,
    payload.ts ? new Date(payload.ts) : new Date(),
    payload.messageId,
    payload.ip,
    null,
    null,
    null,
    null,
    null,
    payload.details
  );
};
