let InscriptionStatsService = require('../../../services/InscriptionStatsService');
const log = require('../../../util/log').getLogger('lastContactStats');

let _inscriptionStatsService = null;
module.exports = async (parent, { inscriptionDate, fromDate, toDate }, context, info) => {
  if (!_inscriptionStatsService) {
    _inscriptionStatsService = new InscriptionStatsService();
  }

  log.debug(`Get inscription stats for inscriptionDate ${inscriptionDate} from ${fromDate} to ${toDate}`);

  return await _inscriptionStatsService.getInscriptionStats(inscriptionDate, fromDate, toDate);
};
