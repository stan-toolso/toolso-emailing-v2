const { Actions } = require('./Actions');
let PermissionService = require('../../services/PermissionService');
const { ForbiddenError } = require('apollo-server-express');
const _permissionService = new PermissionService();

module.exports.checkActionPermission = async (action, context) => {
  let permission = await _permissionService.findWithEmailInCache(context.token.email, context.encryptedToken);
  permission = permission && permission.value;

  switch (action) {
    case Actions.Contacts.List:
    case Actions.Contacts.Get:
    case Actions.Contacts.Delete:
    case Actions.Contacts.Stats:
    case Actions.Contacts.Export:
    case Actions.Contacts.Update: {
      let contactsPerm = permission && permission.contacts ? permission.contacts : {};
      if (!contactsPerm.perm || contactsPerm.perm != 'none') {
        return;
      }
      break;
    }
    case Actions.ApiKeys.List:
    case Actions.ApiKeys.Create:
    case Actions.ApiKeys.Delete: {
      let apiKeysPerm = permission && permission.apiKeys ? permission.apiKeys : {};
      let isAdmin = permission && (permission.role === 'admin' || permission.role === 'superAdmin');
      if (apiKeysPerm?.perm == 'all' || isAdmin) {
        return;
      }
      break;
    }
  }
  throw new ForbiddenError(`Can't perform ${action} action`);
};
