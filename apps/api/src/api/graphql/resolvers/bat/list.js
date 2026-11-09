let BatService = require('../../../../services/BatService');
const log = require('../../../../util/log').getLogger('Bat/list');

let _batService = null;
module.exports = async (parent, { limit, offset, filter }, context, info) => {
  if (!_batService) {
    _batService = new BatService();
  }
  let filterToApply = !filter ? {} : { ...filter };

  if (parent && parent.constructor && parent.constructor.name == 'Partner') {
    filterToApply['partnerId'] = parent.id;
  }

  log.debug(`List with filter ${JSON.stringify(filterToApply)}`);

  return {
    offset: offset,
    limit: limit,
    filter: filterToApply,
    total: await _batService.countAll(filterToApply),
    bats: await _batService.findAll(offset, limit, filterToApply)
  };
};
