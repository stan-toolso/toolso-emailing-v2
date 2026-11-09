const log = require('../util/log').getLogger('EmailTrackingDedupService');

const sequelize = require('../storage/sequelize');
const { Op } = require('sequelize');
const sha256 = require('js-sha256');
const { getJwtSecret } = require('./JwtSecretService');

//fenêtre pendant laquelle on déduplique les ouvertures/clics d'un message.
//Au-delà, les clés sont purgées et il ne reste aucune trace de l'événement.
const DEDUP_RETENTION_DAYS = 30;

//déduplication anonyme des événements de tracking pour les contacts ayant
//refusé le pixel tracking : on ne pose aucun flag sur le ContactContent, on
//stocke uniquement un hash non réversible (messageId + type + secret), purgé
//après DEDUP_RETENTION_DAYS.
module.exports = class {
  constructor() {
    this.EmailTrackingDedup = sequelize.get()?.models?.EmailTrackingDedup;
  }

  _key = async (messageId, type) => {
    let secret = await getJwtSecret();
    return sha256(`${messageId}:${type}:${secret}`);
  };

  //retourne true si c'est le premier événement de ce type pour ce message
  markEvent = async (messageId, type) => {
    let key = await this._key(messageId, type);
    if (await this.EmailTrackingDedup.findByPk(key)) {
      return false;
    }
    try {
      await this.EmailTrackingDedup.create({ id: key });
      return true;
    } catch (err) {
      //insertion concurrente : l'événement a déjà été compté
      log.debug(`Dedup key already inserted for type ${type}`);
      return false;
    }
  };

  hasEvent = async (messageId, type) => {
    return (await this.EmailTrackingDedup.findByPk(await this._key(messageId, type))) != null;
  };

  purge = async (days = DEDUP_RETENTION_DAYS) => {
    let date = new Date(Date.now() - days * 24 * 3600 * 1000);
    let result = await this.EmailTrackingDedup.destroy({
      where: {
        createdAt: {
          [Op.lt]: date
        }
      }
    });
    log.debug(`Email tracking dedup purged. Result : ${result}`);
    return result;
  };
};
