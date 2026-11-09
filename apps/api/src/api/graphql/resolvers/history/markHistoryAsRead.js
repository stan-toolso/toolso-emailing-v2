const log = require('../../../../util/log').getLogger('markHistoryAsRead');

let _historyService = null;
module.exports = async (_parent, { id }) => {
  if (!_historyService) {
    let HistoryService = require('../../../../services/HistoryService');
    _historyService = new HistoryService();
  }

  log.debug(`Notify history ${id}`);
  return await _historyService.markHistoryAsRead(id);
};
