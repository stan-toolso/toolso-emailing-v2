const log = require('../../../util/log').getLogger('inclusionLists');

let _inclusionListService = null;
module.exports = async (parent, { limit, offset, filter }, context, info) => {
  if (!_inclusionListService) {
    let InclusionListService = require('../../../services/InclusionListService');
    _inclusionListService = new InclusionListService();
  }

  log.debug(`Get inclusion Lists Items `);
  let filterToApply = !filter ? {} : { ...filter };
  if (parent && parent.id && parent.constructor.name == 'InclusionList') {
    filterToApply.inclusionListId = parent.id;
  }

  return {
    limit,
    offset,
    filter: filterToApply,
    total: await _inclusionListService.countAllItems(filterToApply),
    inclusionListItems: await _inclusionListService.findAllItems(offset, limit, filterToApply)
  };
};
