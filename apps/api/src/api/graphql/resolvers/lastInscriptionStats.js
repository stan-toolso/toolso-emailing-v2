let InscriptionStatsService = require('../../../services/InscriptionStatsService');
const log = require('../../../util/log').getLogger('lastContactStats');

let _inscriptionStatsService = null;
module.exports = async (parent, { fromInscriptionDate, toInscriptionDate }, context, info) => {
  if (!_inscriptionStatsService) {
    _inscriptionStatsService = new InscriptionStatsService();
  }

  log.debug(`Get last inscription stats from ${fromInscriptionDate} to ${toInscriptionDate}`);

  return await _inscriptionStatsService.getLastInscriptionStats(fromInscriptionDate, toInscriptionDate);
};
