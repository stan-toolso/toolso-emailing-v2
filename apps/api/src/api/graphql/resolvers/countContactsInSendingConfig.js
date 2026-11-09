const log = require('../../../util/log').getLogger('countContactInSendingConfig');

let _sendingConfigService = null;
module.exports = async (parent, { config }, context, info) => {
  if (!_sendingConfigService) {
    let SendingConfigService = require('../../../services/SendingConfigService');
    _sendingConfigService = new SendingConfigService();
  }

  log.debug(`Count contact sending config`);
  return await _sendingConfigService.countContactsInSendingConfig(config);
};
