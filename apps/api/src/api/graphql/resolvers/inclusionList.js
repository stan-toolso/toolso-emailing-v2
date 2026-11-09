const log = require('../../../util/log').getLogger('inclusionLists');

let _inclusionListService = null;
module.exports = async (parent, { id }, context, info) => {
  if (!_inclusionListService) {
    let InclusionListService = require('../../../services/InclusionListService');
    _inclusionListService = new InclusionListService();
  }

  log.debug(`Get inclusion ${id} `);

  return await _inclusionListService.findWithId(id);
};
