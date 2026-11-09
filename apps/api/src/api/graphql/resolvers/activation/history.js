const log = require('../../../../util/log').getLogger('Activation/history');

let _activationService = null;
module.exports = async (parent, { fromDate, toDate, esp }) => {
  if (!_activationService) {
    let ActivationService = require('../../../../services/ActivationService');
    _activationService = new ActivationService();
  }

  if (!parent) {
    return;
  }
  log.debug(`Get ${parent.esp} history config from ${fromDate} to ${toDate}`);

  return await _activationService.getEspHistoryConfigs(parent.esp, fromDate, toDate);
};
