const log = require('../util/log').getLogger('Action service');
const sequelize = require('../storage/sequelize');
const { QueryTypes } = require('sequelize');
const ActionType = require('./ActionType');

const PACKAGE_SIZE = 100;
const INSERT_CHUNK_SIZE = 500;
const MAX_ATTEMPTS = 5;

const Queues = Object.freeze({
  default: 'default',
  huge: 'huge'
});

/** Délai avant de relâcher une action restée « running » (worker arrêté brutalement). */
const STALE_RUNNING_MINUTES = Object.freeze({
  [Queues.default]: 15,
  [Queues.huge]: 90
});

/**
 * File d'actions en PostgreSQL (table `ActionQueue`), à la place des files SQS `actions_<uid>` et `huge_actions`.
 * L'interface de production (`newAction`, `newActions`, `newActionsWithPackage`, `countActions`) est celle de la v1 ;
 * la consommation (`claim`, `complete`, `fail`, `releaseStale`) est utilisée par le worker.
 */
module.exports = class ActionService {
  constructor() {}

  get ActionQueue() {
    return sequelize.get().models.ActionQueue;
  }

  newAction = async (type, payload, huge = false) => {
    if (!type || !payload) {
      log.warn(`Can't produce action with missing data`);
      return;
    }
    const action = {
      type: type,
      payload: payload
    };
    if (huge) {
      action.uid = process.env.RESOURCE_UID;
    }
    await this.ActionQueue.create({
      queue: huge ? Queues.huge : Queues.default,
      type,
      payload
    });
    return action;
  };

  newActionsWithPackage = async (type, payloads) => {
    if (!type || !payloads) {
      log.warn(`Can't produce actions with missing data`);
      return;
    }
    log.debug(`New actions  (${payloads.length}) with package of type ${type}`);
    let packages = [];
    let currentPackage = {
      type,
      payloads: []
    };
    for (let payload of payloads) {
      currentPackage.payloads.push(payload);
      if (currentPackage.payloads.length >= PACKAGE_SIZE) {
        packages.push(currentPackage);
        currentPackage = {
          type,
          payloads: []
        };
      }
    }
    if (currentPackage.payloads.length > 0) {
      packages.push(currentPackage);
    }

    await this.newActions(ActionType.package_action, packages);
  };

  newActions = async (type, payloads) => {
    if (!type || !payloads) {
      log.warn(`Can't produce actions with missing data`);
      return;
    }
    log.debug(`New actions (${payloads.length}) of type ${type}`);
    for (let i = 0; i < payloads.length; i += INSERT_CHUNK_SIZE) {
      const rows = payloads.slice(i, i + INSERT_CHUNK_SIZE).map((payload) => ({
        queue: Queues.default,
        type,
        payload
      }));
      await this.ActionQueue.bulkCreate(rows);
    }
  };

  /** Nombre d'actions en attente ou en cours dans la file principale (équivalent de ApproximateNumberOfMessages). */
  countActions = async (queue = Queues.default) => {
    return await this.ActionQueue.count({
      where: { queue, status: ['pending', 'running'] }
    });
  };

  async sendPayload(type, payload) {
    if (payload) {
      return await this.newAction(type, payload);
    }
  }

  // ---- Consommation (worker) -------------------------------------------------------------

  /**
   * Réserve jusqu'à `limit` actions prêtes de la file `queue` (FOR UPDATE SKIP LOCKED : plusieurs workers peuvent
   * tourner en parallèle sans se marcher dessus).
   */
  claim = async (queue, limit) => {
    const rows = await sequelize.get().query(
      `UPDATE "ActionQueue" SET status = 'running', "lockedAt" = NOW(), attempts = attempts + 1, "updatedAt" = NOW()
       WHERE id IN (
         SELECT id FROM "ActionQueue"
         WHERE queue = :queue AND status = 'pending' AND "availableAt" <= NOW()
         ORDER BY id
         LIMIT :limit
         FOR UPDATE SKIP LOCKED
       )
       RETURNING id, queue, type, payload, attempts`,
      { replacements: { queue, limit }, type: QueryTypes.UPDATE }
    );
    return rows[0] ?? [];
  };

  complete = async (id) => {
    await this.ActionQueue.destroy({ where: { id } });
  };

  /** Échec : nouvelle tentative avec délai croissant, puis statut `failed` (conservé pour analyse). */
  fail = async (action, error) => {
    const message = (error && (error.stack || error.message || String(error))) ?? 'unknown error';
    if (action.attempts >= MAX_ATTEMPTS) {
      log.error(`Action ${action.id} (${action.type}) failed ${action.attempts} times. Giving up.`);
      await this.ActionQueue.update({ status: 'failed', lastError: message.substring(0, 4000) }, { where: { id: action.id } });
      return;
    }
    const delaySeconds = Math.min(600, 30 * Math.pow(2, action.attempts - 1));
    await this.ActionQueue.update({ status: 'pending', lastError: message.substring(0, 4000), availableAt: new Date(Date.now() + delaySeconds * 1000), lockedAt: null }, { where: { id: action.id } });
  };

  /** Remet en attente les actions bloquées en `running` depuis trop longtemps (worker arrêté brutalement). */
  releaseStale = async (queue) => {
    const minutes = STALE_RUNNING_MINUTES[queue] ?? 15;
    const [, count] = await sequelize.get().query(
      `UPDATE "ActionQueue" SET status = 'pending', "lockedAt" = NULL, "updatedAt" = NOW()
       WHERE queue = :queue AND status = 'running' AND "lockedAt" < NOW() - (:minutes || ' minutes')::interval`,
      { replacements: { queue, minutes: `${minutes}` }, type: QueryTypes.UPDATE }
    );
    if (count > 0) {
      log.warn(`${count} stale running actions released in queue ${queue}`);
    }
    return count;
  };

  /** Supprime les actions en échec définitif plus vieilles que `days` jours. */
  purgeFailed = async (days = 30) => {
    return await this.ActionQueue.destroy({
      where: { status: 'failed', updatedAt: { [require('sequelize').Op.lt]: new Date(Date.now() - days * 24 * 3600 * 1000) } }
    });
  };
};

module.exports.Queues = Queues;
