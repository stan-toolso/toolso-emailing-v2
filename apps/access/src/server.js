require('dotenv').config();

const log = require('./log').getLogger('AccessManager API');
const config = require('./config');
const sequelize = require('./storage/sequelize');
const graphql = require('./api/graphql');

const start = async () => {
  // Échoue tôt si la configuration indispensable manque.
  config.jwtSecret();
  config.publicUrl();

  await sequelize.initAccess();
  await sequelize.get().authenticate();
  log.info(`Postgresql is initialized with sequelize.`);

  const app = await graphql.initExpress();
  const port = config.port();

  return new Promise((resolve, reject) => {
    const server = app.listen(port, '0.0.0.0', () => {
      log.info(`🚀 Access API ready at http://0.0.0.0:${port}/graphql`);
      resolve(server);
    });
    server.on('error', reject);
  });
};

if (require.main === module) {
  start().catch((err) => {
    log.fatal(`Failed to start access API`, err);
    process.exit(1);
  });

  const shutdown = (signal) => {
    log.info(`Received ${signal}, shutting down`);
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = { start };
