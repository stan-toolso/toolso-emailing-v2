let PermissionService = require('../../../../services/PermissionService');
const log = require('../../../../util/log').getLogger('Permission/list');

let _permissionService = null;
module.exports = async (parent, { limit, offset, filter }, context, info) => {
  if (!_permissionService) {
    _permissionService = new PermissionService();
  }

  log.debug(`List with filter ${JSON.stringify(filter)}`);

  return {
    offset: offset,
    limit: limit,
    filter: filter,
    total: await _permissionService.countAll(filter),
    list: await _permissionService.findAll(offset, limit, filter)
  };
};
