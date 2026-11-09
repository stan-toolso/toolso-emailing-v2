let UserService = require("../../../services/UserService");
let UserEntrepriseService = require("../../../services/UserEntrepriseService");
const { AuthenticationError, ForbiddenError } = require('../../errors');
const log = require('../../../log').getLogger(
  "GraphQL/UserEntreprise/Update"
);

let _userService = null;
let _userEntrepriseService = null;
module.exports = async (parent, { input }, context, info) => {
  log.debug(`Remove ${JSON.stringify(input)}`);
  if (!context.user) {
    log.warn(`User is not logged. Request aborted`);
    throw new AuthenticationError("You must be logged in");
  }

  if (!_userService) {
    _userService = new UserService();
    _userEntrepriseService = new UserEntrepriseService();
  }

  let user = context.user;

  let userEntreprise = await _userEntrepriseService.get(input.id);

  if(!userEntreprise || !(await _userEntrepriseService.canEditEntreprise(user.id, userEntreprise.entrepriseId))){
    throw new ForbiddenError("You must be entreprise ADMIN to do that");
  }
  await userEntreprise.destroy();
  
  return {
    status : 'ok'
  }

};
