const log = require('../../../util/log').getLogger('ContactPost');

let _inscriptionService = null;
module.exports = async (req, res) => {
  if (!_inscriptionService) {
    const InscriptionService = require('../../../services/InscriptionService');
    _inscriptionService = new InscriptionService();
  }

  log.debug(`New contact inscription received ${JSON.stringify(req.body)}`);

  let { success, inscription, errorCode, message } = await _inscriptionService.createContactInscription(
    req.body.email,
    req.body.fields ? req.body.fields : {},
    req.body.ip,
    req.body.collectUrl,
    req.body.sourceName,
    req.body.scheduleIds,
    req.body.skipWelcomeMail
  );

  res.json({
    status: success && inscription ? 'ok' : 'ko',
    accepted: success && inscription && inscription.isFirst,
    duplicated: success && inscription && !inscription.isFirst,
    errorCode: errorCode ? errorCode : null,
    message: message ? message : null
  });
};
