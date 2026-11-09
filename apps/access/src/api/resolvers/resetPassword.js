let UserService = require("../../services/UserService");
const log = require('../../log').getLogger(
  "resetPassword"
);

let _userService = null;
module.exports = async (parent, { token, password }, context, info) => {
  if (!_userService) {
    _userService = new UserService();
  }
  log.debug(`resetPassword with token [${token.substring(0, 5)}...]`);


  let user = await _userService.getWithToken(token);
  let authToken = null;
  if(user){
    await _userService.setUserPassword(user, password);
    authToken = await _userService.authWithPassword(user.email, password);
  }
  return {
    user,
    token : authToken
  };

};
