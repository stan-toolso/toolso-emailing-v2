const log = require('../../../util/log').getLogger('createSendingConfig');

let _sendingConfigService = null;
module.exports = async (parent, { name }, context, info) => {
  if (!_sendingConfigService) {
    let SendingConfigService = require('../../../services/SendingConfigService');
    _sendingConfigService = new SendingConfigService();
  }

  log.debug(`Create sending config ${name}`);
  return await _sendingConfigService.createWithName(name);
};
