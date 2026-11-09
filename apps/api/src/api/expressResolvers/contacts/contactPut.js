const log = require('../../../util/log').getLogger('contactUpdateFieldsPut');

let _contactService = null;
module.exports = async (req, res) => {
  if (!_contactService) {
    const ContactService = require('../../../services/ContactService');
    _contactService = new ContactService();
  }

  var email = req.body && req.body.email ? req.body.email : req.query && req.query.email ? req.query.email : req.params.email;
  var id = req.body && req.body.id ? req.body && req.body.id : req.query && req.query.id;

  log.debug(`New contact [${email}] fields update received ${JSON.stringify(req.body)}`);

  let contact = null;
  let contactFromId = null;

  if (!email && !id) {
    res.status(400).json({
      status: 'ko',
      code: 'bad_request',
      message: 'Either email or id is mandatory'
    });
    return;
  }

  if (email) {
    contact = await _contactService.findWithEmail(email);
  }
  if (id) {
    contactFromId = await _contactService.findWithId(id);
  }

  if (email && id) {
    var bothcontactsExistAndAreDifferent = contact && contactFromId && contact.id != contactFromId.id;
    var onlyOneContactFetched = (contact && !contactFromId) || (!contact && contactFromId);
    if (bothcontactsExistAndAreDifferent || onlyOneContactFetched) {
      res.status(400).json({
        status: 'ko',
        code: 'bad_request',
        message: 'email does not match id'
      });
      return;
    }
  }

  if (contactFromId) {
    contact = contactFromId;
  }

  if (contact) {
    await _contactService.mergeFieldsInContact(contact, req.body.fields);
    await contact.save();
    res.json({
      status: 'ok',
      contact
    });
  } else {
    res.status(404).json({
      status: 'ko',
      code: 'not_found',
      message: 'contact is missing'
    });
  }
};
