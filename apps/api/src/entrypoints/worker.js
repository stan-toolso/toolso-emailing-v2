const log = require('../util/log').getLogger('Worker process');
const { PromisePool } = require('@supercharge/promise-pool');
const config = require('../util/config');
const ActionService = require('../services/ActionService');
const { executeAction } = require('../queue/executeAction');

const IDLE_DELAY_MS = 1000;
const STALE_CHECK_INTERVAL_MS = 60 * 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Rôle `worker` : consomme la file d'actions (ex-Lambdas `{uid}_action` sur SQS `actions_{uid}` et `huge_actions`).
 * `WORKER_QUEUE` = default | huge ; `WORKER_CONCURRENCY` actions en parallèle.
 */
const startWorker = async ({ queue = config.workerQueue(), concurrency = config.workerConcurrency() } = {}) => {
  const actionService = new ActionService();
  let running = true;
  let lastStaleCheck = 0;
  log.info(`Worker started on queue "${queue}" with concurrency ${concurrency}`);

  const loop = (async () => {
    while (running) {
      try {
        if (Date.now() - lastStaleCheck > STALE_CHECK_INTERVAL_MS) {
          lastStaleCheck = Date.now();
          await actionService.releaseStale(queue);
        }
        const actions = await actionService.claim(queue, concurrency);
        if (actions.length === 0) {
          await sleep(IDLE_DELAY_MS);
          continue;
        }
        await PromisePool.withConcurrency(concurrency)
          .for(actions)
          .process(async (action) => {
            try {
              await executeAction(action);
              await actionService.complete(action.id);
            } catch (err) {
              log.error(`Action ${action.id} (${action.type}) failed`, err);
              await actionService.fail(action, err);
            }
          });
      } catch (err) {
        log.error('Worker loop error', err);
        await sleep(5000);
      }
    }
  })();

  return {
    stop: async () => {
      running = false;
      await loop;
      log.info('Worker stopped');
    }
  };
};

module.exports = { startWorker };
