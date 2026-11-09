const config = require('../util/config');

/**
 * Le secret JWT est partagé avec l'access API (variable `JWT_SECRET`). Il sert aussi à chiffrer les identifiants
 * des routeurs de mail en base (`SettingsService.encryptString`) : lors d'une reprise de données depuis AWS, il doit
 * reprendre la valeur du secret `jwt_secret` d'origine.
 */
const getJwtSecret = async () => {
  return config.jwtSecret();
};

module.exports = {
  getJwtSecret
};
