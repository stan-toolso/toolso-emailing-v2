let SenderService = require('../../../../services/SenderService');
const log = require('../../../../util/log').getLogger('Sender/create');

let _senderService = null;
module.exports = async (parent, { name }, context, info) => {
  if (!_senderService) {
    _senderService = new SenderService();
  }

  log.debug(`Create Sender with name ${name}`);
  return await _senderService.createWithName(name);
};
