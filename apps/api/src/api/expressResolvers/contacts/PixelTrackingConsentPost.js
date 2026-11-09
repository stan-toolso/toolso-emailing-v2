const log = require('../../../util/log').getLogger('contactPixelTrackingConsentPost');

let _contactService = null;
let _historyService = null;
module.exports = async (req, res) => {
  if (!_contactService) {
    const ContactService = require('../../../services/ContactService');
    _contactService = new ContactService();
  }
  if (!_historyService) {
    const HistoryService = require('../../../services/HistoryService');
    _historyService = new HistoryService();
  }

  let { email, pixel_tracking_consent, date, source } = req.body ?? {};

  log.debug(`New pixel tracking consent received ${JSON.stringify(req.body)}`);

  let errors = [];
  if (typeof pixel_tracking_consent !== 'boolean') {
    errors.push({
      field: 'pixel_tracking_consent',
      message: 'Required field, must be a boolean'
    });
  }
  if (!email) {
    errors.push({
      field: 'email',
      message: 'Required field'
    });
  }

  let consentDate = date ? new Date(date) : new Date();
  if (isNaN(consentDate.getTime())) {
    errors.push({
      field: 'date',
      message: 'Invalid date'
    });
  }

  if (errors.length > 0) {
    res.status(400).json({
      status: 'ko',
      code: 'invalid_payload',
      message: 'The payload is invalid.',
      errors
    });
    return;
  }

  let contact = await _contactService.findWithEmail(email);
  if (!contact) {
    res.status(404).json({
      status: 'ko',
      code: 'contact_not_found',
      message: 'Contact not found'
    });
    return;
  }

  contact.pixelTrackingConsent = pixel_tracking_consent;
  await contact.save();

  await _historyService.createHistory(
    'Rest API',
    {
      pixel_tracking_consent,
      source: source ?? null,
      date: consentDate
    },
    'pixel_tracking_consent_update',
    'contact',
    contact.id,
    1
  );

  res.json({
    status: 'ok',
    code: 'pixel_tracking_consent_updated',
    contact
  });
};
