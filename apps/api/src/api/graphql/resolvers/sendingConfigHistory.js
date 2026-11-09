const log = require('../../../util/log').getLogger('contactMessages');

let _historyService = null;
module.exports = async (parent) => {
  if (!_historyService) {
    let HistoryService = require('../../../services/HistoryService');
    _historyService = new HistoryService();
  }

  if (parent && parent.id && parent.constructor.name == 'SendingConfig') {
    log.debug(`Get history for sendingConfig  ${parent.id}`);
    return await _historyService.findAll('sendingConfig', parent.id, 50, 0)?.history;
  }

  return null;
};
