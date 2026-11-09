const log = require('../../../log').getLogger('userEnterprises');

let _userEntrepriseService = null;
module.exports = async (user, {}, _context, _info) => {
  log.debug(`Get emailing enterprises of user ${user.id}, ${user.email}`);
  if (!_userEntrepriseService) {
    let UserEntrepriseService = require('../../../services/UserEntrepriseService');
    _userEntrepriseService = new UserEntrepriseService();
  }

  if (user?.id) {
    return await _userEntrepriseService.getByUSerId(user.id);
  }
  return null;
};
