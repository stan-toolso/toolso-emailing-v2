const { ApolloServer, gql, AuthenticationError } = require('apollo-server-express');
const log = require('../../util/log').getLogger('GraphQL');
const fs = require('fs');

module.exports = {
  initGraphQLServer: () => {
    log.debug('Init Apollo server');

    const typeDefs = gql(fs.readFileSync(__dirname + '/typeDefs.graphql', 'utf8'));
    const resolvers = require('./resolvers');

    const BASIC_LOGGING = {
      requestDidStart(requestContext) {
        let email = requestContext.context && requestContext.context.token && requestContext.context.token.email;
        log.info(`[${email}] Run query ${JSON.stringify(requestContext.request.query)} with variables ${JSON.stringify(requestContext.request.variables)}`);
      }
    };

    return new ApolloServer({
      typeDefs,
      resolvers,
      uploads: false,
      plugins: [BASIC_LOGGING],
      formatError: (err) => {
        log.error('GraphQL failed', err);
        return err;
      },
      context: ({ req }) => {
        if (req.token) {
          return {
            ip: req.ip,
            token: req.token,
            encryptedToken: req.encryptedToken
          };
        } else {
          throw new AuthenticationError('you must be logged in');
        }
      }
    });
  }
};
