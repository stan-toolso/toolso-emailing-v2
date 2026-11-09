let UserService = require('../../services/UserService');
const { AuthenticationError } = require('../errors');

const log = require('../../log').getLogger('authWithPassword');

let _userService = null;
module.exports = async (_parent, {}, context) => {
  if (!_userService) {
    _userService = new UserService();
  }

  log.debug(`Get Me`);
  if (!context.user) {
    log.warn(`User is not logged. Request aborted`);
    throw new AuthenticationError('You must be logged in');
  }

  if (!context.token) {
    throw new Error('UNAUTHENTIFICATED');
  } else {
    return await context.user;
  }
};
