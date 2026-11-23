'use strict';
const jwt = require('jsonwebtoken');

const log = require('../../util/log').getLogger('ApiKeyMiddleware');

let _apiKeyService = null;

const MEDIA_COMPAT_SCOPE = 'media-compat';
const isMediaCompatPath = (req) => (req.path || '').indexOf('/v1/') === 0;

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
    // clé reprise de media (permissions.scope = 'media-compat') : valable seulement sur l'API de transition /v1/…
    const mediaOnly = apiKeyFound?.permissions?.scope === MEDIA_COMPAT_SCOPE;
    if (mediaOnly && !isMediaCompatPath(req)) {
      log.debug(`ApiKey ${apiKeyFound.id} réservée à l'API de transition media.`);
    } else if (apiKeyFound && apiKeyFound.enabled) {
      req.token = {
        email: `apikey-${apiKeyFound.id}-${apiKeyFound.name}`
      };
    } else {
      log.debug(`ApiKey ${apiKey} not found.`);
    }
  }
  next();
};
