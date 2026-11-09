let SenderService = require('../../../../services/SenderService');
const log = require('../../../../util/log').getLogger('Sender/delete');

let _senderService = null;
module.exports = async (parent, { id }, context, info) => {
  if (!_senderService) {
    _senderService = new SenderService();
  }

  log.debug(`Delete ${id} `);
  if (await _senderService.markAsDeleted(id)) {
    return 'ok';
  } else {
    return 'ko';
  }
};
