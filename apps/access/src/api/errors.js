const { GraphQLError } = require('graphql');

// Équivalents des AuthenticationError / ForbiddenError d'apollo-server-express 2 :
// même message, même `extensions.code` (UNAUTHENTICATED / FORBIDDEN) dans la réponse GraphQL.
class AuthenticationError extends GraphQLError {
  constructor(message) {
    super(message, { extensions: { code: 'UNAUTHENTICATED' } });
    this.name = 'AuthenticationError';
  }
}

class ForbiddenError extends GraphQLError {
  constructor(message) {
    super(message, { extensions: { code: 'FORBIDDEN' } });
    this.name = 'ForbiddenError';
  }
}

module.exports = { AuthenticationError, ForbiddenError };
