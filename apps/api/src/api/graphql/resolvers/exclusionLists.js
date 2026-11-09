const log = require('../../../util/log').getLogger('exclusionLists');

let _exclusionListService = null;
module.exports = async (parent, { limit, offset, filter }, context, info) => {
  if (!_exclusionListService) {
    let ExclusionListService = require('../../../services/ExclusionListService');
    _exclusionListService = new ExclusionListService();
  }

  log.debug(`Get exclusion Lists `);

  return {
    limit,
    offset,
    filter,
    total: await _exclusionListService.countAll(filter),
    exclusionLists: await _exclusionListService.findAll(offset, limit, filter)
  };
};
