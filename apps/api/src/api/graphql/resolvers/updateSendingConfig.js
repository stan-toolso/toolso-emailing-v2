const log = require('../../../util/log').getLogger('updateSendingConfig');

let _sendingConfigService = null;
module.exports = async (_parent, { sendingConfig }, context) => {
  if (!_sendingConfigService) {
    let SendingConfigService = require('../../../services/SendingConfigService');
    _sendingConfigService = new SendingConfigService();
  }

  log.debug(`Update sending config ${sendingConfig.id}`);
  return await _sendingConfigService.update(sendingConfig, context.token.email);
};
