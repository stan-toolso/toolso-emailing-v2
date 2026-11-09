let UserEntrepriseService = require("../../../services/UserEntrepriseService");
const { AuthenticationError, ForbiddenError } = require('../../errors');
const log = require('../../../log').getLogger(
  "GraphQL/UserEntreprise/Ignore"
);


let _userEntrepriseService = null;
module.exports = async (parent, { input }, context, info) => {
  log.debug(`Remove ${JSON.stringify(input)}`);
  if (!context.user) {
    log.warn(`User is not logged. Request aborted`);
    throw new AuthenticationError("You must be logged in");
  }

  if (!_userEntrepriseService) {
    _userEntrepriseService = new UserEntrepriseService();
  }

  let user = context.user;

  let userEntreprise = await _userEntrepriseService.get(input.id);

  if(!userEntreprise || userEntreprise.userId !== user.id){
    throw new ForbiddenError("You are not allowed to do that");

  }


  await userEntreprise.destroy();
  
  return {
    status : 'ok'
  }

};
