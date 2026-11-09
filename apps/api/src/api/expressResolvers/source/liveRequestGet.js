const log = require('../../../util/log').getLogger('SourceContactInscriptionPost');
const ContactService = require('../../../services/ContactService');
const contactService = new ContactService();

const { getCachedSettings } = require('../../../services/SettingsService');

const { validateEmail, validateCapping, validateApiSettings } = require('./SourceUtil');
var moment = require('moment-timezone');

module.exports = async (req, res) => {
  let source = req.source;

  if (!source.apiEnabled || !source.apiFields) {
    res.json({
      status: 'ko',
      accepted: false,
      errors: [
        {
          errorCode: 'api_disabled',
          message: `API is disabled`
        }
      ]
    });
    return;
  }

  let email = req.query.email;
  if (!email) {
    errors.push({
      status: 'ko',
      accepted: false,
      errors: [
        {
          errorCode: 'field_required',
          message: `Field "email" is required`
        }
      ]
    });
    return;
  }

  let errors = await validateCapping(source);

  if (errors && errors.length) {
    res.json({
      status: 'ko',
      accepted: false,
      errors
    });
    return;
  }
  let emailValidation = await validateEmail(email);
  if (!emailValidation.success) {
    res.json({
      status: 'ko',
      accepted: false,
      errors: [
        {
          errorCode: 'invalid_email',
          message: 'The email is invalid. Many reasons can cause this error: the email is blacklisted, the ESP is invalid, or the email pattern is excluded.'
        }
      ]
    });
    return;
  }
  let sourceValidation = await validateApiSettings(email, source);
  if (!sourceValidation.accepted) {
    res.json({
      status: 'ko',
      ...sourceValidation
    });
    return;
  }

  let existingContact = await contactService.findWithEmail(email);
  if (existingContact) {
    let lastInscription = await existingContact.getLastInscription();
    let timezone = (await getCachedSettings(['timezone'])).timezone;
    let startOfday = moment().tz(timezone).startOf('day');
    if (lastInscription && lastInscription.inscriptionDate && moment(lastInscription.inscriptionDate).tz(timezone) >= startOfday) {
      res.json({
        status: 'ok',
        accepted: false,
        alreadyReceivedToday: true,
        duplicated: true,
        errors: [
          {
            errorCode: 'contact_already_subscribed_today',
            message: `Contact already subscribed today`
          }
        ]
      });
      return;
    } else {
      if (!source.apiSettings || !source.apiSettings.acceptDuplicates) {
        res.json({
          status: 'ok',
          accepted: false,
          duplicated: true,
          alreadyReceivedToday: false,
          errors: [
            {
              errorCode: 'contact_already_subscribed',
              message: `Contact already subscribed`
            }
          ]
        });
        return;
      }
    }
  }

  log.debug(`New contact inscription received ${JSON.stringify(req.body)} for source ${source.name}`);

  res.json({
    status: 'ok',
    accepted: true,
    duplicated: existingContact ? true : false,
    alreadyReceivedToday: false
  });
};
