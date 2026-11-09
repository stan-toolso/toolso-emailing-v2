let PermissionService = require('../../../../services/PermissionService');
const log = require('../../../../util/log').getLogger('Permission/my');

let _permissionService = null;
module.exports = async (parent, props, context) => {
  if (!_permissionService) {
    _permissionService = new PermissionService();
  }

  log.debug(`My ${context.token.email}`);

  return await _permissionService.findWithEmailInCache(context.token.email, context.encryptedToken);
};
