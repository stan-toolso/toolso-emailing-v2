const log = require('../../../util/log').getLogger('contentHistory');

let _historyService = null;
module.exports = async (parent) => {
  if (!_historyService) {
    let HistoryService = require('../../../services/HistoryService');
    _historyService = new HistoryService();
  }

  if (parent && parent.id && parent.constructor.name == 'Content') {
    log.debug(`Get history for content  ${parent.id}`);
    let result = await _historyService.findAll('content', parent.id, 50, 0);
    return result?.history;
  }

  return null;
};
