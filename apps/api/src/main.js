require('dotenv').config();
const log = require('./util/log').getLogger('Main');
const sequelize = require('./storage/sequelize');
const config = require('./util/config');

/**
 * Entrée unique de l'instance autonome. `ROLE` = api | worker | scheduler | all.
 */
const ROLE = process.env.ROLE || 'all';

(async () => {
  const stoppers = [];
  try {
    if (!config.resourceUid()) {
      throw new Error('RESOURCE_UID is not defined');
    }
    const poolSize = ROLE === 'scheduler' ? config.pgPoolMax(20) : config.pgPoolMax(10);
    await sequelize.initWithPostgresql(poolSize);
    log.info(`Postgresql is initialized with sequelize (role ${ROLE}, pool ${poolSize}).`);

    if (ROLE === 'api' || ROLE === 'all') {
      const server = await require('./entrypoints/api').startApi();
      stoppers.push(() => new Promise((resolve) => server.close(resolve)));
    }
    if (ROLE === 'worker' || ROLE === 'all') {
      const worker = await require('./entrypoints/worker').startWorker();
      stoppers.push(worker.stop);
      if (ROLE === 'all') {
        const hugeWorker = await require('./entrypoints/worker').startWorker({ queue: 'huge', concurrency: 1 });
        stoppers.push(hugeWorker.stop);
      }
    }
    if (ROLE === 'scheduler' || ROLE === 'all') {
      const scheduler = await require('./entrypoints/scheduler').startScheduler();
      stoppers.push(scheduler.stop);
    }
    if (!['api', 'worker', 'scheduler', 'all'].includes(ROLE)) {
      throw new Error(`Unknown ROLE ${ROLE}`);
    }
  } catch (err) {
    log.fatal('Failed to start', err);
    process.exit(1);
  }

  let stopping = false;
  const shutdown = async (signal) => {
    if (stopping) {
      return;
    }
    stopping = true;
    log.info(`${signal} received: shutting down`);
    const timer = setTimeout(() => {
      log.error('Forced exit after 30s');
      process.exit(1);
    }, 30000);
    try {
      for (const stop of stoppers.reverse()) {
        await stop();
      }
      await sequelize.close();
    } catch (err) {
      log.error('Error during shutdown', err);
    }
    clearTimeout(timer);
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => log.error('Unhandled rejection', reason));
})();
