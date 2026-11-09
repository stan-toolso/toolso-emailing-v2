const log = require('../../../util/log').getLogger('contactUnsubscribePost');

let _inscriptionService = null;
module.exports = async (req, res) => {
  if (!_inscriptionService) {
    const InscriptionService = require('../../../services/InscriptionService');
    _inscriptionService = new InscriptionService();
  }


  log.debug(`New contact unsub received ${JSON.stringify(req.body)}`);

  await _inscriptionService.unsubscribeContact(req.body.email, req.body.collectUrl, req.body.ip);

  res.json({
    status: 'ok'
  });
};
