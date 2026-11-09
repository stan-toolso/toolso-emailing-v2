const log = require('../../../../util/log').getLogger('updateSuggestion');

let _suggestionService = null;
let _permissionService = null;
module.exports = async (_parent, { suggestion }, context) => {
  if (!_suggestionService) {
    let SuggestionService = require('../../../../services/SuggestionService');
    _suggestionService = new SuggestionService();
  }
  if (!_permissionService) {
    let PermissionService = require('../../../../services/PermissionService');
    _permissionService = new PermissionService();
  }

  let email = context.token.email;
  let role = await _permissionService.getRole(context.encryptedToken, process.env.RESOURCE_UID);
  let isSuperAdmin = role == 'superAdmin' || (role == 'admin' && email.endsWith('toolso.io'));
  suggestion.user = email;

  log.debug(`update Suggestion ${suggestion?.id}`);
  return await _suggestionService.updateSuggestion(suggestion, isSuperAdmin);
};
