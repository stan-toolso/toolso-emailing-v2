const log = require('../../../util/log').getLogger('create inclusion list');

let _inclusionListService = null;
module.exports = async (parent, { name }, context, info) => {
  if (!_inclusionListService) {
    let InclusionListService = require('../../../services/InclusionListService');
    _inclusionListService = new InclusionListService();
  }

  log.debug(`Create inclusion list`);
  return await _inclusionListService.createInclusionList(name);
};
