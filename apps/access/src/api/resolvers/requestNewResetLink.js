let UserService = require("../../services/UserService");
const log = require('../../log').getLogger(
  "requestNewResetLink"
);

let _userService = null;
module.exports = async (parent, { email }, context, info) => {
  if (!_userService) {
    _userService = new UserService();
  }
  log.debug(`Request new reset link [${email}]`);
  let user = await _userService.getWithEmail(email);
  if (!user) {
    return "ko";
  }
  try {
    await _userService.generateResetToken(user, true);
  } catch (ex) {
    return "ko";
  }
  return "ok";
};
