const log = require('../../../util/log').getLogger('Delete');

function isValid(email) {
  return email && typeof email == 'string';
}

let _contactService = null;
module.exports = async (req, res) => {
  if (!_contactService) {
    const ContactService = require('../../../services/ContactService');
    _contactService = new ContactService();
  }

  var email = req.body.email ? req.body.email : req.query.email;

  if (isValid(email)) {
    log.debug(`New contact deletion received ${req.body.email}`);
    var result = await _contactService.removeContactWithEmail(email);
    if (result) {
      res.status(200).json({
        status: 'ok'
      });
    } else {
      res.status(404).json({
        status: 'ko',
        code: 'not_found',
        message: 'contact is missing'
      });
    }
  } else {
    res.status(400).json({
      status: 'ko',
      code: 'bad_request',
      message: 'Email is missing or incorrect'
    });
  }
};
