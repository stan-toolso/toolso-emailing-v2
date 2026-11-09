import gql from 'graphql-tag';
import { doSignedQuery, EventType, LOCAL_STORAGE_JWT_TOKEN } from './AccessManager/AccessManager';
import { emit, subscribe } from './AppEvents/AppEvents';
import EmailingDatabaseApi from './EmailingDatabaseApi';

const REFRESH_USER = gql`
  query me($entrepriseId: ID!) {
    me {
      id
      email

      entreprises {
        id
        pending
        role
        entreprise {
          id
          name
          settings
        }
      }
      emailingDatabases(entrepriseId: $entrepriseId) {
        id
        uid
        name
        apiEndpoint
      }
    }
  }
`;

const ENTREPRISE_ID = 'emailing_entreprise_id';

export default class {
  constructor(history, location, reduxDispatch) {
    this.history = history;
    this.location = location;
    this.reduxDispatch = reduxDispatch;
    this.lastPath = location && location.pathname && location.pathname !== '/login' && location.pathname !== '/entreprise' ? location.pathname : '/';
    this.currentEmailingDatabase = null;
    subscribe(EventType.new_token, this.onNewToken.bind(this));
    subscribe(EventType.disconnect, this.onDisconnect.bind(this));
    subscribe(EventType.new_entreprise, this.onNewEntreprise.bind(this));
    history.listen(this.onHistoryChanged.bind(this));

    this._init();
  }

  async _init() {
    await this.refreshUser();
    if (!this.user) {
      if (this.location.pathname && this.location.pathname !== '/login' && this.location.pathname.indexOf('/reset') < 0 && this.location.pathname.indexOf('/join') < 0) {
        this.history.push('/login');
      }
    } else if (!this.entreprise) {
      this.history.push('/entreprise');
    } else {
      if (this.location.pathname !== this.lastPath) {
        this.history.push(this.lastPath);
      }
      if (this.location.pathname !== '/login') {
        this.refreshCurrentEmailingDatabase(this.location);
      }
    }
    this.reduxDispatch({ type: 'set', stateReady: true });
  }
  onHistoryChanged(location) {
    this.location = location;
    if (location && location.pathname !== '/login' && location.pathname !== '/entreprise') {
      this.lastPath = location.pathname;

      this.refreshCurrentEmailingDatabase(location);
    }
  }
  refreshCurrentEmailingDatabase(location) {
    if (this.user && location) {
      const paths = location.pathname.split('/');
      const firstPath = paths.length > 1 ? paths[1] : null;
      if (!this.currentEmailingDatabase || this.currentEmailingDatabase.uid !== firstPath) {
        this.currentEmailingDatabase = null;
        for (let emailingDatabase of this.user.emailingDatabases) {
          if (emailingDatabase.uid === firstPath) {
            this.currentEmailingDatabase = emailingDatabase;
          }
        }

        this.reduxDispatch({
          type: 'set',
          currentEmailingDatabase: this.currentEmailingDatabase
        });
      }
      if (this.currentEmailingDatabase) {
        new EmailingDatabaseApi(this.currentEmailingDatabase)
          .doQuery({
            query: gql`
              query {
                myPermission {
                  id
                  email
                  value
                }
              }
            `
          })
          .then((result) => {
            this.reduxDispatch({
              type: 'set',
              permission: result && result.data && result.data.myPermission ? result.data.myPermission.value : null
            });
          });
      } else {
        this.reduxDispatch({
          type: 'set',
          permission: null
        });
      }
    }
  }
  refreshCurrentEntreprise() {
    if (this.user) {
      if (this.user.entreprises.length === 1 && !this.user.entreprises[0].pending) {
        let userEntreprise = this.user.entreprises[0];
        let entreprise = this.user.entreprises[0].entreprise;
        if (!this.entreprise || parseInt(this.entreprise.id) !== parseInt(entreprise.id)) {
          this.entreprise = entreprise;
          this.userEntreprise = userEntreprise;
          this.reduxDispatch({ type: 'set', entreprise: this.entreprise });
          this.reduxDispatch({
            type: 'set',
            userEntreprise: this.userEntreprise
          });
          emit(EventType.new_entreprise, this.entreprise);
          emit(EventType.new_user_entreprise, this.userEntreprise);
        }
      } else {
        let entrepriseId = localStorage.getItem(ENTREPRISE_ID);
        if (entrepriseId && (!this.entreprise || this.entreprise.id !== entrepriseId)) {
          this.entreprise = null;
          for (let entreprise of this.user.entreprises) {
            if (entreprise.entreprise.id === entrepriseId) {
              this.userEntreprise = entreprise;
              this.entreprise = entreprise.entreprise;
              this.reduxDispatch({ type: 'set', entreprise: this.entreprise });

              this.reduxDispatch({
                type: 'set',
                userEntreprise: this.userEntreprise
              });
              emit(EventType.new_entreprise, this.entreprise);
            }
          }
        }
      }
    }
  }
  onNewEntreprise(entreprise) {
    this.entreprise = entreprise;
    if (entreprise) {
      localStorage.setItem(ENTREPRISE_ID, entreprise.id);
    } else {
      localStorage.removeItem(ENTREPRISE_ID);
    }
    this._init();
  }

  onNewToken(token) {
    localStorage.setItem(LOCAL_STORAGE_JWT_TOKEN, token);
    this._init();
  }
  onDisconnect() {
    this.user = null;
    this.reduxDispatch({ type: 'set', user: null });
    localStorage.removeItem(LOCAL_STORAGE_JWT_TOKEN);
    this.history.push('/login');
  }

  async refreshUser() {
    try {
      let result = await doSignedQuery({
        query: REFRESH_USER,
        variables: {
          entrepriseId: localStorage.getItem(ENTREPRISE_ID) && !isNaN(localStorage.getItem(ENTREPRISE_ID)) ? localStorage.getItem(ENTREPRISE_ID) : 0
        }
      });
      if (result && result.data && result.data.me) {
        this.user = result.data.me;
        this.reduxDispatch({ type: 'set', user: this.user });
        this.reduxDispatch({
          type: 'set',
          emailingDatabases: JSON.parse(JSON.stringify(this.user.emailingDatabases))
        });
        this.refreshCurrentEntreprise();
      }
    } catch (err) {
      this.reduxDispatch({ type: 'set', user: null });
      err?.message && console.log(err?.message);
    }
  }
}
