const log = require('../util/log').getLogger('API process');
const config = require('../util/config');

/** Rôle `api` : serveur HTTP Express + Apollo (ex-Lambda `{uid}_api` + `ses_webhook` + `tracking_api` + `mirror_api`). */
const startApi = async () => {
  const api = require('../api/api');
  const app = api.initApi();
  const port = config.port();
  return await new Promise((resolve) => {
    const server = app.listen({ port, host: '0.0.0.0' }, () => {
      log.info(`🚀 API ready on port ${port} for database ${config.resourceUid()}`);
      resolve(server);
    });
    server.keepAliveTimeout = 65 * 1000;
    server.headersTimeout = 66 * 1000;
  });
};

module.exports = { startApi };
