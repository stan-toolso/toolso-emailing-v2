let UserService = require('../../services/UserService');
let EmailingDatabaseService = require('../../services/EmailingDatabaseService');
let UserEntrepriseService = require('../../services/UserEntrepriseService');
const { AuthenticationError } = require('../errors');

const log = require('../../log').getLogger('getMyDatabaseRole');

let _userService = null;
let _emailingDatabaseService = null;
let _userEntrepriseService = null;
module.exports = async (_, { uid }, context) => {
  if (!_userService) {
    _userService = new UserService();
  }
  if (!_emailingDatabaseService) {
    _emailingDatabaseService = new EmailingDatabaseService();
  }
  if (!_userEntrepriseService) {
    _userEntrepriseService = new UserEntrepriseService();
  }

  log.debug(`Get My Database Role`);
  if (!context.user) {
    log.warn(`User is not logged. Request aborted`);
    throw new AuthenticationError('You must be logged in');
  }

  if (!context.token) {
    throw new Error('UNAUTHENTIFICATED');
  } else {
    let database = await _emailingDatabaseService.getWithUid(uid);
    if (database) {
      let entrepriseId = database.entrepriseId;
      let result = await _userEntrepriseService.getByUSerId(context.user.id, entrepriseId);
      return result[0];
    }
  }

  return null;
};
