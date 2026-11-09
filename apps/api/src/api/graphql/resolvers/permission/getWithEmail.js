let PermissionService = require('../../../../services/PermissionService');
const log = require('../../../../util/log').getLogger('Permission/getWithEmail');

let _permissionService = null;
module.exports = async (parent, { email }, context, info) => {
  if (!_permissionService) {
    _permissionService = new PermissionService();
  }

  log.debug(`Get ${email}`);

  return await _permissionService.findWithEmail(email);
};
