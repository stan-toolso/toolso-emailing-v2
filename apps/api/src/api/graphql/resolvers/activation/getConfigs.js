const log = require('../../../../util/log').getLogger('Activation/getConfigs');

let _activationService = null;
module.exports = async () => {
  if (!_activationService) {
    let ActivationService = require('../../../../services/ActivationService');
    _activationService = new ActivationService();
  }

  log.debug(`Get all configs`);

  return await _activationService.getTodayConfigs();
};
