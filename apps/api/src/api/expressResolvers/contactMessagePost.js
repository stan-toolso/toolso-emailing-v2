const log = require('../../util/log').getLogger('ContactInscriptionPost');

let _contactMessageservice = null;
module.exports = async (req, res) => {
  if (!_contactMessageservice) {
    const ContactMessageService = require('../../services/ContactMessageService');
    _contactMessageservice = new ContactMessageService();
  }
  log.debug(`New contact message received ${JSON.stringify(req.body)}`);

  let message = await _contactMessageservice.createContactMessage({
    from: req.body.from,
    to: req.body.to,
    title: req.body.title,
    message: req.body.message,
    status: req.body.status ? req.body.status : null
  });
  if (req.body.unsub) {
    const InscriptionService = require('../../services/InscriptionService');
    await new InscriptionService().unsubscribeContact(req.body.from, null, null);
  }

  if (req.body.blacklist) {
    const BlacklistedContactService = require('../../services/BlacklistedContactService');
    await new BlacklistedContactService().blacklistContact(req.body.from, null, null, null, 'From message', null);
  }

  res.json({
    status: message ? 'ok' : 'ko'
  });
};
