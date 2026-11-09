const log = require('../util/log').getLogger('API');
const path = require('path');

module.exports = {
  initApi: () => {
    log.debug('Init Site API');

    const app = require('./expressApp').initExpress();
    app.set('views', path.join(__dirname, '..', '..', 'views'));
    app.set('trust proxy', true);

    // Instance autonome : routes qui étaient des Lambdas séparées (tracking, miroir, webhooks) ou des services AWS (uploads S3)
    app.use(require('./tracking/trackingRoutes').router);
    app.use(require('./webhooks/webhookRoutes').router);
    app.use(require('./uploadRoutes').router);
    app.get('/health', async (req, res) => {
      try {
        await require('../storage/sequelize').get().query('SELECT 1');
        res.json({ status: 'ok', uid: process.env.RESOURCE_UID, version: require('../../package.json').version });
      } catch (err) {
        res.status(503).json({ status: 'ko', error: err.message });
      }
    });

    const graphQLServer = require('./graphql/graphql').initGraphQLServer();
    graphQLServer.applyMiddleware({
      app,
      path: '/graphql'
    });

    return app;
  }
};
