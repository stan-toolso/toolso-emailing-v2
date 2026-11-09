let SenderService = require('../../../../services/SenderService');
const log = require('../../../../util/log').getLogger('Sender/list');

let _senderService = null;
module.exports = async (parent, { filter }, context, info) => {
  if (!_senderService) {
    _senderService = new SenderService();
  }

  log.debug(`List with filter ${JSON.stringify(filter)}`);

  return await _senderService.findAll(filter);
};
