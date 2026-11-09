let UserService = require('../../../services/UserService');
const { AuthenticationError } = require('../../errors');
const log = require('../../../log').getLogger('GraphQL/Entreprise/Get');
const sequelize = require('../../../storage/sequelize');

let _userService = null;
module.exports = async (parent, { id }, context, info) => {
  log.debug(`Get entreprise ${id}`);
  if (!context.user) {
    log.warn(`User is not logged. Request aborted`);
    throw new AuthenticationError('You must be logged in');
  }

  if (!_userService) {
    _userService = new UserService();
  }

  id = parseInt(id);

  let user = context.user;
  let superUser = await user.getSuperUser();
  if (user) {
    if (superUser) {
      let entreprises = await sequelize.get().models.Entreprise.findAll();
      return entreprises.find((ent) => ent.id === id);
    } else {
      let entreprises = await user.getEntreprises();
      entreprises = entreprises.filter((e) => {
        return e.entrepriseId === id;
      });
      if (entreprises.length > 0) {
        return await entreprises[0].getEntreprise();
      }
    }
  }

  return null;
};
