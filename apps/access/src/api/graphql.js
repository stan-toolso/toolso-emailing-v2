const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@as-integrations/express4');
const sequelize = require('../storage/sequelize');
const log = require('../log').getLogger('GraphQL');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { DateTimeResolver, JSONResolver } = require('graphql-scalars');
const TokenMiddleware = require('./middlewares/TokenMiddleware');

module.exports = {
  // Construit l'application Express (route /graphql + /health). Asynchrone : Apollo Server 4+ exige `start()`.
  initExpress: async () => {
    log.debug('Init Express server');

    if (!sequelize.get()) {
      log.error('Sequelize is not initialized. Please initialize it first !');
    }

    const app = express();
    app.use(express.json());
    app.use(cors());

    app.use(TokenMiddleware);

    app.get('/health', async (_req, res) => {
      try {
        await sequelize.get().query('SELECT 1');
        res.json({ status: 'ok', database: 'ok' });
      } catch (err) {
        log.error(`Health check failed`, err);
        res.status(503).json({ status: 'ko', database: 'ko' });
      }
    });

    const typeDefs = fs.readFileSync(__dirname + '/typeDefs.graphql', 'utf8');

    const resolvers = {
      Query: {
        me: require('./resolvers/me'),
        getMyDatabaseRole: require('./resolvers/getMyDatabaseRole'),
        meWithToken: require('./resolvers/meWithToken'),
        entreprise: require('./resolvers/entreprise/get'),
        getEnterpriseAndUsers: require('./resolvers/user_entreprise/getEnterpriseAndUsers')
      },
      Mutation: {
        authWithPassword: require('./resolvers/authWithPassword'),
        resetPassword: require('./resolvers/resetPassword'),
        requestNewResetLink: require('./resolvers/requestNewResetLink'),

        updateUserEntreprise: require('./resolvers/user_entreprise/update'),
        removeUserEntreprise: require('./resolvers/user_entreprise/remove'),
        createUserEntreprise: require('./resolvers/user_entreprise/create'),
        acceptUserEntreprise: require('./resolvers/user_entreprise/accept'),
        ignoreUserEntreprise: require('./resolvers/user_entreprise/ignore')
      },
      DateTime: DateTimeResolver,
      JSON: JSONResolver,
      User: {
        entreprises: require('./resolvers/entreprise/userEnterprises'),
        emailingDatabases: require('./resolvers/userEmailingDatabases'),
        sites: require('./resolvers/userSites')
      },
      Entreprise: {
        users: (entreprise) => entreprise.getUsers()
      },
      UserEntreprise: {
        entreprise: (item) => item.getEntreprise(),
        user: (item) => item.getUser()
      }
    };

    const apolloServer = new ApolloServer({
      typeDefs,
      resolvers,
      introspection: true,
      includeStacktraceInErrorResponses: false
    });
    await apolloServer.start();

    app.use(
      '/graphql',
      expressMiddleware(apolloServer, {
        context: async ({ req }) => {
          if (req.token) {
            return {
              token: req.token,
              user: req.user
            };
          }
          return {};
        }
      })
    );

    return app;
  }
};
