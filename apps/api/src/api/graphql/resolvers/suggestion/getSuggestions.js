const log = require('../../../../util/log').getLogger('getSuggestions');

let _suggestionService = null;
module.exports = async (_parent, { onlyActive, limit, offset }) => {
  if (!_suggestionService) {
    let SuggestionService = require('../../../../services/SuggestionService');
    _suggestionService = new SuggestionService();
  }

  log.debug(`Get suggestions`);
  let wantedStatus = onlyActive ? ['todo', 'draft'] : null;
  return await _suggestionService.findAll(wantedStatus, null, limit, offset);
};
