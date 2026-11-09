'use strict';
const jwt = require('jsonwebtoken');

const log = require('../../util/log').getLogger('ApiKeyMiddleware');

let _apiKeyService = null;

module.exports = async (req, res, next) => {
  if (req.originalUrl.indexOf('/source/') == 0) {
    next();

    return;
  }
  if (req.headers.apiKey || req.headers['api-key'] || req.headers['apikey']) {
    let apiKey = req.headers.apiKey ? req.headers.apiKey : req.headers['api-key'] ? req.headers['api-key'] : req.headers['apikey'];

    if (!_apiKeyService) {
      const ApiKeyService = require('../../services/ApiKeyService');
      _apiKeyService = new ApiKeyService();
    }
    let apiKeyFound = await _apiKeyService.findWithApiKey(apiKey);
    if (apiKeyFound && apiKeyFound.enabled) {
      req.token = {
        email: `apikey-${apiKeyFound.id}-${apiKeyFound.name}`
      };
    } else {
      log.debug(`ApiKey ${apiKey} not found.`);
    }
  }
  next();
};
