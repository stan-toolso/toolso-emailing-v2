const log = require('../../../util/log').getLogger('deleteSendingConfig');

let _sendingConfigService = null;
module.exports = async (parent, { sendingConfigId }, context, info) => {
  if (!_sendingConfigService) {
    let SendingConfigService = require('../../../services/SendingConfigService');
    _sendingConfigService = new SendingConfigService();
  }

  log.debug(`Delete sending config ${sendingConfigId}`);
  if (await _sendingConfigService.delete(sendingConfigId)) {
    return 'ok';
  } else {
    return 'ko';
  }
};
