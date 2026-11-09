let UserService = require("../../services/UserService");
const log = require('../../log').getLogger("authWithPassword");

let _userService = null;
module.exports = async (parent, { token }, context, info) => {
  if (!_userService) {
    _userService = new UserService();
  }

  log.debug(`Get Me with token`);
 
  return await _userService.getWithToken(token);
};
