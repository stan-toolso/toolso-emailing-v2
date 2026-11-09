let UserService = require('../../services/UserService');
const log = require('../../log').getLogger('authWithPassword');

let _userService = null;
module.exports = async (_parent, { email, password }) => {
  if (!_userService) {
    _userService = new UserService();
  }

  log.debug(`Auth with email and password [${email}]`);

  return await _userService.authWithPassword(email, password);
};
