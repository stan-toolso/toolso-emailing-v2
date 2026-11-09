const { readFile: readFromS3, Folders: Buckets } = require('../FileStorageService');

let _sendingConfigService = null;

module.exports = async (payload) => {
  if (!_sendingConfigService) {
    let SendingConfigService = require('../SendingConfigService');
    _sendingConfigService = new SendingConfigService();
  }

  const config = await _sendingConfigService.findWithId(payload.id);
  if (config) {
    await _sendingConfigService.updateConfigScores(config);
  }
};
