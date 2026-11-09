const log = require('../../util/log').getLogger('pixelConsentPage');
const CryptoJS = require('crypto-js');

let _contactService = null;
let _historyService = null;

const _getContactFromToken = async (req) => {
  if (!_contactService) {
    const ContactService = require('../../services/ContactService');
    _contactService = new ContactService();
  }
  try {
    let { key, token } = req.params;
    let decrypted = CryptoJS.AES.decrypt(token, key).toString(CryptoJS.enc.Utf8);
    let decryptedObject = JSON.parse(decrypted);
    if (!decryptedObject || !decryptedObject.email) {
      return { decryptedObject: null, contact: null };
    }
    let contact = await _contactService.findWithEmail(decryptedObject.email);
    return { decryptedObject, contact };
  } catch (err) {
    log.debug(`Failed to decrypt pixel consent token`, err);
    return { decryptedObject: null, contact: null };
  }
};

const _renderPage = (res, contact, success = false) => {
  res.render('pixelConsent', {
    contact,
    success,
    optedOut: contact ? contact.pixelTrackingConsent === false : null
  });
};

module.exports = async (req, res) => {
  let { decryptedObject, contact } = await _getContactFromToken(req);

  if (req.method !== 'POST') {
    _renderPage(res, contact);
    return;
  }

  let action = req.body?._action;
  let success = false;
  if (contact && (action === 'tls_pixel_consent_optout' || action === 'tls_pixel_consent_optin')) {
    if (!_historyService) {
      const HistoryService = require('../../services/HistoryService');
      _historyService = new HistoryService();
    }
    let pixelTrackingConsent = action === 'tls_pixel_consent_optin';
    log.info(`Contact ${contact.id} set pixelTrackingConsent=${pixelTrackingConsent} from consent page`);
    contact.pixelTrackingConsent = pixelTrackingConsent;
    await contact.save();

    await _historyService.createHistory(
      'Consent page',
      {
        pixel_tracking_consent: pixelTrackingConsent,
        source: 'pixel_consent_page',
        mirrorId: decryptedObject.mirrorId ?? null,
        user_agent: req.headers['user-agent'],
        ip: req.clientIp ?? req.headers['x-forwarded-for'] ?? req.socket.remoteAddress
      },
      'pixel_tracking_consent_update',
      'contact',
      contact.id,
      1
    );
    success = true;
  }
  _renderPage(res, contact, success);
};
