import { ApolloClient, InMemoryCache } from '@apollo/client';
import { emit } from '../AppEvents/AppEvents';

let ACCESS_MANAGER_END_POINT = 'https://accessapi.toolso.io/graphql';
const LOCAL_STORAGE_JWT_TOKEN = 'JWT_TOKEN';

if (process.env.REACT_APP_ACCESS_API_ENDPOINT) {
  console.warn(`accesApiEndpoint changed ${process.env.REACT_APP_ACCESS_API_ENDPOINT}`);
  ACCESS_MANAGER_END_POINT = process.env.REACT_APP_ACCESS_API_ENDPOINT;
}

const doQuery = async (query) => {
  return getClient().query(query);
};

const _client = new ApolloClient({
  uri: ACCESS_MANAGER_END_POINT,
  cache: new InMemoryCache()
});

const getClient = () => {
  return _client;
};

let _signedClient = null;
let _jwtToken = null;
const getSignedClient = () => {
  let jwtToken = localStorage.getItem(LOCAL_STORAGE_JWT_TOKEN);
  if (jwtToken !== _jwtToken) {
    _jwtToken = jwtToken;
    _signedClient = new ApolloClient({
      uri: ACCESS_MANAGER_END_POINT,
      cache: new InMemoryCache(),
      headers: {
        authorization: `Bearer ${jwtToken}`
      }
    });
  }

  return _signedClient;
};

const doSignedQuery = async (query) => {
  let jwtToken = localStorage.getItem(LOCAL_STORAGE_JWT_TOKEN);
  if (!jwtToken) {
    emit(EventType.invalid_token);
    throw new Error('invalid_token');
  } else {
    try {
      return new ApolloClient({
        uri: ACCESS_MANAGER_END_POINT,
        cache: new InMemoryCache(),
        headers: {
          authorization: `Bearer ${jwtToken}`
        }
      }).query(query);
    } catch (err) {
      if (err.graphQLErrors) {
        err.graphQLErrors.forEach((errorItem) => {
          if (errorItem.message === 'UNAUTHENTIFICATED') {
            //GlobalEvents.emit('invalid_token');
            throw new Error('invalid_token');
          }
        });
      }
      console.log(err);
      throw new Error('server_error');
    }
  }
};

const EventType = Object.freeze({
  invalid_token: 'invalid_token',
  new_token: 'new_token',
  new_user_entreprise: 'new_user_entreprise',
  new_entreprise: 'new_entreprise',
  disconnect: 'disconnect'
});

export default EventType;

export { getClient, getSignedClient, doQuery, doSignedQuery, EventType, LOCAL_STORAGE_JWT_TOKEN };
