let ApiKeyService = require('../../../services/ApiKeyService');
const log = require('../../../util/log').getLogger('apiKeys');
const { checkActionPermission } = require('../permissionFilter');
const { Actions } = require('../Actions');

let _apiKeyService = null;
module.exports = async (_1, _2, context) => {
  if (!_apiKeyService) {
    _apiKeyService = new ApiKeyService();
  }

  log.debug(`get Api Keys`);
  await checkActionPermission(Actions.ApiKeys.List, context);
  return await _apiKeyService.findAll();
};
