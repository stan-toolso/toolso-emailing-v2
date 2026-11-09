let InscriptionService = require('../../../services/InscriptionService');
const log = require('../../../util/log').getLogger('contactInscription');

let _inscriptionService = null;
module.exports = async (parent, { id }, context, info) => {
  if (!_inscriptionService) {
    _inscriptionService = new InscriptionService();
  }

  log.debug(`Get contact inscription ${id}`);

  return await _inscriptionService.findWithId(id);
};
