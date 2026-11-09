const log = require('../../../util/log').getLogger('inclusionLists');

let _inclusionListService = null;
module.exports = async (parent, { limit, offset, filter }, context, info) => {
  if (!_inclusionListService) {
    let InclusionListService = require('../../../services/InclusionListService');
    _inclusionListService = new InclusionListService();
  }

  log.debug(`Get inclusion Lists `);

  return {
    limit,
    offset,
    filter,
    total: await _inclusionListService.countAll(filter),
    inclusionLists: await _inclusionListService.findAll(offset, limit, filter)
  };
};
