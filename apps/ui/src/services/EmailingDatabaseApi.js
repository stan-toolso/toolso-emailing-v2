import { ApolloClient, InMemoryCache, concat, ApolloLink } from '@apollo/client';
import { createUploadLink } from 'apollo-upload-client';
import { EventType, LOCAL_STORAGE_JWT_TOKEN } from './AccessManager/AccessManager';
import { emit, subscribe } from './AppEvents/AppEvents';
import { toast } from 'react-toastify';

const authMiddleware = new ApolloLink((operation, forward) => {
  // add the authorization to the headers
  try {
    return forward(operation);
  } catch (err) {
    if (err.graphQLErrors) {
      err.graphQLErrors.forEach((errorItem) => {
        if (errorItem.message === 'UNAUTHENTIFICATED') {
          this._throwAndAlert('invalid_token', 'Connexion expired, please refresh your browser');
        }
      });
    }
    console.log(err);
    throw new Error('server_error');
  }
});

export default class {
  _refreshClient() {
    let jwtToken = localStorage.getItem(LOCAL_STORAGE_JWT_TOKEN);
    let uploadLink = createUploadLink({
      uri: this.database.apiEndpoint + '/graphql',
      headers: {
        authorization: `Bearer ${jwtToken}`
      }
    });
    this.client = new ApolloClient({
      link: concat(authMiddleware, uploadLink),
      cache: new InMemoryCache()
    });
  }

  getDatabase() {
    return this.database;
  }

  constructor(database) {
    this.database = JSON.parse(JSON.stringify(database));
    if (process.env.REACT_APP_API_ENDPOINT) {
      console.warn(`apiEndpoint changed ${process.env.REACT_APP_API_ENDPOINT}`);
      this.database.apiEndpoint = process.env.REACT_APP_API_ENDPOINT;
    }

    this._refreshClient();
    subscribe(EventType.new_token, this._refreshClient);
  }

  getUid() {
    return this.database.uid;
  }
  getApiEndpoint() {
    return this.database.apiEndpoint;
  }

  getClient() {
    return this.client;
  }

  buildUrl(path) {
    let jwtToken = localStorage.getItem(LOCAL_STORAGE_JWT_TOKEN);
    return `${this.database.apiEndpoint}${path}${path.indexOf('?') >= 0 ? '&' : '?'}jwt_token=${jwtToken}`;
  }

  async _throwAndAlert(error, message) {
    toast.error(message, {
      position: toast.POSITION.BOTTOM_RIGHT
    });
    throw new Error(error);
  }

  async doQuery(query) {
    let jwtToken = localStorage.getItem(LOCAL_STORAGE_JWT_TOKEN);
    if (!jwtToken) {
      emit(EventType.invalid_token);
      this._throwAndAlert('invalid_token', 'Connexion expired, please refresh your browser');
    } else {
      return await this.client.query(query);
    }
  }

  async doMutation(mutation) {
    let jwtToken = localStorage.getItem(LOCAL_STORAGE_JWT_TOKEN);
    if (!jwtToken) {
      emit(EventType.invalid_token);
      throw new Error('invalid_token');
    } else {
      return await this.client.mutate(mutation);
    }
  }
}
