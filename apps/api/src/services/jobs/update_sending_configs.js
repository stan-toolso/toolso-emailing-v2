module.exports = async () => {
  const SendingConfigService = require('../SendingConfigService');
  await new SendingConfigService().updateAllConfigsScores();
};
