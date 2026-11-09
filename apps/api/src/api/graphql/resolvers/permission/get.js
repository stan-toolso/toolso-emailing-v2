let PermissionService = require('../../../../services/PermissionService');
const log = require('../../../../util/log').getLogger('Permission/get');

let _permissionService = null;
module.exports = async (parent, { id }, context, info) => {
  if (!_permissionService) {
    _permissionService = new PermissionService();
  }

  log.debug(`Get ${id}`);

  return await _permissionService.findWithId(id);
};
