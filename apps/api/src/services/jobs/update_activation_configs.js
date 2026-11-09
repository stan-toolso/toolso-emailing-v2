module.exports = async () => {
  const ActivationService = require('../ActivationService');
  let activationService = new ActivationService();
  await activationService.adjustAllConfigs();
  await activationService.checkActivationConfigs();
};
