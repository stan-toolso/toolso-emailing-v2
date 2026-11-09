let ContentService = require('../../../services/ContentService');
const log = require('../../../util/log').getLogger('contents');

let _contentService = null;
module.exports = async (parent, { limit, offset, filter }, context, info) => {
  if (!_contentService) {
    _contentService = new ContentService();
  }
  let filterToApply = !filter ? {} : { ...filter };

  if (parent && parent.constructor && parent.constructor.name == 'Schedule') {
    filterToApply['scheduleId'] = parent.id;
  }

  log.debug(`Get contents `);
  let res = {
    offset: offset,
    limit: limit,
    filter: filterToApply,
    total: await _contentService.countAll(filterToApply),
    contents: await _contentService.findAll(offset, limit, filterToApply)
  };
  return res;
};
