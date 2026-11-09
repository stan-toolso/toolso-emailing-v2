let ApiKeyService = require('../../../services/ApiKeyService');
const log = require('../../../util/log').getLogger('createApiKey');
const { checkActionPermission } = require('../permissionFilter');
const { Actions } = require('../Actions');

let _apiKeyService = null;
module.exports = async (_, { name }, context) => {
  if (!_apiKeyService) {
    _apiKeyService = new ApiKeyService();
  }

  await checkActionPermission(Actions.ApiKeys.Create, context);

  log.debug(`Create Api Key with name ${name}`);
  return await _apiKeyService.createApiKey(name);
};
