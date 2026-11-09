let ApiKeyService = require('../../../services/ApiKeyService');
const log = require('../../../util/log').getLogger('deleteApiKey');
const { checkActionPermission } = require('../permissionFilter');
const { Actions } = require('../Actions');

let _apiKeyService = null;
module.exports = async (_, { id }, context) => {
  if (!_apiKeyService) {
    _apiKeyService = new ApiKeyService();
  }

  await checkActionPermission(Actions.ApiKeys.Delete, context);

  log.debug(`Delete Api Key with id ${id}`);
  let result = await _apiKeyService.deleteApiKey(id);
  return result ? 'ok' : 'ko';
};
