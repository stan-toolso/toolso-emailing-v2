const log = require('../../../../util/log').getLogger('Activation/getConfig');

let _activationService = null;
module.exports = async (parent, { esp }, context, info) => {
  if (!_activationService) {
    let ActivationService = require('../../../../services/ActivationService');
    _activationService = new ActivationService();
  }

  log.debug(`Get ${esp}`);

  return await _activationService.getTodayConfig(esp);
};
