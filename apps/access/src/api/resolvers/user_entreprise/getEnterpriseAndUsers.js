let UserEntrepriseService = require('../../../services/UserEntrepriseService');
const { AuthenticationError } = require('../../errors');
const log = require('../../../log').getLogger('GraphQL/userEntreprise/getEnterpriseAndUsers');
const sequelize = require('../../../storage/sequelize');

let _userEntrepriseService = null;
module.exports = async (_parent, { uid }, context, _info) => {
  log.debug(`Get GetEnterpriseAndUsers for ${uid}`);
  if (!context.user) {
    log.warn(`User is not logged. Request aborted`);
    throw new AuthenticationError('You must be logged in');
  }

  if (!_userEntrepriseService) {
    _userEntrepriseService = new UserEntrepriseService();
  }

  return await _userEntrepriseService.GetEnterpriseAndUsers(uid);
};
