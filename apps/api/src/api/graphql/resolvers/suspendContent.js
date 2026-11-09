let ContentService = require('../../../services/ContentService');
let PermissionService = require('../../../services/PermissionService');
const log = require('../../../util/log').getLogger('Unschedule content');

let _contentService = null;
let _permissionService = null;
module.exports = async (_, { contentId, suspensionReason, additionalText, enterpriseId }, context) => {
  if (!_contentService) {
    _contentService = new ContentService();
  }
  if (!_permissionService) {
    _permissionService = new PermissionService();
  }

  let email = context.token.email;
  let role = await _permissionService.getRole(context.encryptedToken, process.env.RESOURCE_UID);
  let emailingDatabase = enterpriseId ? await _permissionService.getEmailingDatabase(context.encryptedToken, enterpriseId, process.env.RESOURCE_UID) : null;
  let enterprise = await _permissionService.getEnterprise(context.encryptedToken, enterpriseId);
  let to = enterprise.users.map((user) => user?.user?.email);

  let isSuperAdmin = role == 'superAdmin' || (role == 'admin' && email.endsWith('toolso.io'));

  if (!isSuperAdmin) {
    throw new Error('user Need to be Super Admin to suspend Content');
  }

  log.debug(`suspend content ${contentId}`);
  return await _contentService.suspendContent(contentId, email, suspensionReason, additionalText, to, emailingDatabase?.name);
};
