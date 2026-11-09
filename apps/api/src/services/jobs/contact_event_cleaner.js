module.exports = async () => {
  const ContactEventService = require('../ContactEventService');
  await new ContactEventService().clean();

  const ContactContentService = require('../ContactContentService');
  await new ContactContentService().clean();

  const EmailTrackingDedupService = require('../EmailTrackingDedupService');
  await new EmailTrackingDedupService().purge();
};
