const log = require('../../../util/log').getLogger('exclusionLists');

let _exclusionListService = null;
module.exports = async (parent, { limit, offset, filter }, context, info) => {
  if (!_exclusionListService) {
    let ExclusionListService = require('../../../services/ExclusionListService');
    _exclusionListService = new ExclusionListService();
  }

  log.debug(`Get exclusion Lists Items `);
  let filterToApply = !filter ? {} : { ...filter };

  if (parent && parent.id && parent.constructor.name == 'ExclusionList') {
    filterToApply.exclusionListId = parent.id;
  }

  return {
    limit,
    offset,
    filter: filterToApply,
    total: await _exclusionListService.countAllItems(filterToApply),
    exclusionListItems: await _exclusionListService.findAllItems(offset, limit, filterToApply)
  };
};
