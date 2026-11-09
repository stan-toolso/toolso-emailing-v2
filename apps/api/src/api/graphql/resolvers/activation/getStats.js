const log = require('../../../../util/log').getLogger('Activation/getStats');

let _activationStatsService = null;
module.exports = async (parent, { fromDate, toDate, esp }, context, info) => {
  if (!_activationStatsService) {
    let ActivationStatsService = require('../../../../services/ActivationStatsService');
    _activationStatsService = new ActivationStatsService();
  }

  log.debug(`Get stats from ${fromDate} to ${toDate}. Esp : ${esp}`);

  return await _activationStatsService.getActivationStats(fromDate, toDate, esp);
};
