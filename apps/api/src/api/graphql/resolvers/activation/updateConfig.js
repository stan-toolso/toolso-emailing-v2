const log = require('../../../../util/log').getLogger('Activation/updateConfig');

let _activationService = null;
module.exports = async (parent, { input }, context, info) => {
  if (!_activationService) {
    let ActivationService = require('../../../../services/ActivationService');
    _activationService = new ActivationService();
  }

  log.debug(`Update ${JSON.stringify(input)}`);

  return await _activationService.updateTodayConfig(input);
};
