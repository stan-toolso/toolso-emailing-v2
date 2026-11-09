'use strict';
let UserService = require('../../services/UserService');
const log = require('../../log').getLogger('TokenMiddleware');

let _userService = null;
module.exports = async (req, _res, next) => {
  if (!_userService) {
    _userService = new UserService();
  }
  //log.debug(JSON.stringify(req.headers));
  if (!req.headers.authorization) {
    req.token = null;
    next();
  } else {
    var tokenValue = req.headers.authorization;
    if (tokenValue.indexOf('Bearer') == 0) {
      tokenValue = tokenValue.substring(7);
    }
    log.debug(tokenValue);
    try {
      let { user, token } = await _userService.verifyToken(tokenValue);
      req.user = user;
      req.token = token;

      log.debug('Token verified');
    } catch (err) {
      log.debug(`Failed to verify token ${err}`);
    }
    next();
  }
};
