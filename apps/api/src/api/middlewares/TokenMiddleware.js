'use strict';
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../../services/JwtSecretService');

const log = require('../../util/log').getLogger('TokenMiddleware');

module.exports = async (req, res, next) => {
  if (req.token) {
    next();
  } else {
    var token = req.headers.authorization ? req.headers.authorization : req.query.jwt_token;
    if (!token) {
      next();
      return;
    }
    if (token.indexOf('Bearer') == 0) {
      token = token.substring(7);
    }
    try {
      let secret = await getJwtSecret();
      req.token = jwt.verify(token, secret);
      req.encryptedToken = token;
    } catch (err) {
      log.error(`Failed to verify token`, err);
      req.token = null;
    }
    next();
  }
};
