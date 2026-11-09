const log = require('../../../util/log').getLogger('create exclusion list');

let _exclusionListService = null;
module.exports = async (parent, { name }, context, info) => {
  if (!_exclusionListService) {
    let ExclusionListService = require('../../../services/ExclusionListService');
    _exclusionListService = new ExclusionListService();
  }

  log.debug(`Create exclusion list`);
  return await _exclusionListService.createExclusionList(name);
};
