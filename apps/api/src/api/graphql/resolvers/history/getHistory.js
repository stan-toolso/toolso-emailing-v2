const log = require('../../../../util/log').getLogger('getHistory');

let _historyService = null;
module.exports = async (_parent, { limit, offset }) => {
  if (!_historyService) {
    let HistoryService = require('../../../../services/HistoryService');
    _historyService = new HistoryService();
  }

  log.debug(`Get ${limit} history from ${offset}`);
  return await _historyService.findAll(null, null, limit, offset);
};
