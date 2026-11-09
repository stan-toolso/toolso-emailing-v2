const log = require('../../../util/log').getLogger('update inclusion list');

let _inclusionListService = null;
module.exports = async (parent, { inclusionList }, context, info) => {
  if (!_inclusionListService) {
    let InclusionListService = require('../../../services/InclusionListService');
    _inclusionListService = new InclusionListService();
  }

  log.debug(`Update inclusion List ${inclusionList.id}`);
  return await _inclusionListService.updateInclusionList(inclusionList);
};
