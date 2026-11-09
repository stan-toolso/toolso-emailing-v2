const log = require('../../../util/log').getLogger('update exclusion list');

let _exclusionListService = null;
module.exports = async (parent, { exclusionList }, context, info) => {
  if (!_exclusionListService) {
    let ExclusionListService = require('../../../services/ExclusionListService');
    _exclusionListService = new ExclusionListService();
  }

  log.debug(`Update exclusion List ${exclusionList.id}`);
  return await _exclusionListService.updateExclusionList(exclusionList);
};
