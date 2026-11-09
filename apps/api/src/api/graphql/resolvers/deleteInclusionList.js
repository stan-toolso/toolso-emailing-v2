const log = require('../../../util/log').getLogger('deleteInclusionList');

let _inclusionListService = null;
module.exports = async (parent, { inclusionListId }, context, info) => {
  if (!_inclusionListService) {
    let InclusionListService = require('../../../services/InclusionListService');
    _inclusionListService = new InclusionListService();
  }

  log.debug(`Delete inclusion list ${inclusionListId}`);
  if (await _inclusionListService.deleteInclusionList(inclusionListId)) {
    return 'ok';
  } else {
    return 'ko';
  }
};
