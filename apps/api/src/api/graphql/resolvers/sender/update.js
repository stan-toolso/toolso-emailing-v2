let SenderService = require('../../../../services/SenderService');
const log = require('../../../../util/log').getLogger('Sender/update');

let _senderService = null;
module.exports = async (parent, { sender }, context, info) => {
  if (!_senderService) {
    _senderService = new SenderService();
  }

  log.debug(`Update ${sender.id}`);
  return await _senderService.update(sender);
};
