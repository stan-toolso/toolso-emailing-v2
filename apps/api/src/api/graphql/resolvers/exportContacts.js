const ActionType = require('../../../services/ActionType');
const { Actions } = require('../Actions');
const { checkActionPermission } = require('../permissionFilter');
let PermissionService = require('../../../services/PermissionService');

const log = require('../../../util/log').getLogger('contacts');

let _actionService = null;
let _permissionService = null;
module.exports = async (_parent, { fields, format, filter, enterpriseId }, context) => {
  if (!_actionService) {
    let ActionService = require('../../../services/ActionService');
    _actionService = new ActionService();
  }
  if (!_permissionService) {
    _permissionService = new PermissionService();
  }

  log.debug(`Export contacts ${JSON.stringify(fields)} in formmat ${JSON.stringify(format)}`);

  await checkActionPermission(Actions.Contacts.Export, context);
  let emailingDatabase = enterpriseId ? await _permissionService.getEmailingDatabase(context.encryptedToken, enterpriseId, process.env.RESOURCE_UID) : null;

  await _actionService.newAction(
    ActionType.export_contacts,
    {
      fields,
      format,
      filter,
      tos: [context.token.email],
      databaseName: emailingDatabase ? emailingDatabase.name : ''
    },
    true
  );

  return 'OK';
};
