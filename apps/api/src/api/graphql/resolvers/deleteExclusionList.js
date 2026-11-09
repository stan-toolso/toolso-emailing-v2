const log = require('../../../util/log').getLogger('deleteExclusionList');

let _exclusionListService = null;
module.exports = async (parent, { exclusionListId }, context, info) => {
  if (!_exclusionListService) {
    let ExclusionListService = require('../../../services/ExclusionListService');
    _exclusionListService = new ExclusionListService();
  }

  log.debug(`Delete exclusion list ${exclusionListId}`);
  if (await _exclusionListService.deleteExclusionList(exclusionListId)) {
    return 'ok';
  } else {
    return 'ko';
  }
};
