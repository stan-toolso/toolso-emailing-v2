let UserService = require('../../../services/UserService');
let UserEntrepriseService = require('../../../services/UserEntrepriseService');
const { AuthenticationError, ForbiddenError } = require('../../errors');
const log = require('../../../log').getLogger('GraphQL/UserEntreprise/create');

let _userService = null;
let _userEntrepriseService = null;
module.exports = async (_parent, { input }, context, _info) => {
  log.debug(`Create ${JSON.stringify(input)}`);
  if (!context.user) {
    log.warn(`User is not logged. Request aborted`);
    throw new AuthenticationError('You must be logged in');
  }

  if (!_userService) {
    _userService = new UserService();
    _userEntrepriseService = new UserEntrepriseService();
  }

  let user = context.user;
  let superUser = await user?.getSuperUser();
  if (!superUser && !(await _userEntrepriseService.canEditEntreprise(user.id, input.entrepriseId))) {
    throw new ForbiddenError('You must be entreprise ADMIN to do that');
  }

  let newUserEntreprise = await _userEntrepriseService.create(input);

  return {
    userEntreprise: newUserEntreprise
  };
};
