import { createStore } from 'redux';

const initialState = {
  user: null,
  emailingDatabases: null,
  currentEntreprise: null,
  currentUserEntreprise: null,
  currentEmailingDatabase: null,
  sidebarShow: 'responsive',
  stateReady: false
};

const changeState = (state = initialState, { type, ...rest }) => {
  switch (type) {
    case 'set':
      return { ...state, ...rest };
    default:
      return state;
  }
};

const store = createStore(
  changeState,

  window.__REDUX_DEVTOOLS_EXTENSION__ && window.__REDUX_DEVTOOLS_EXTENSION__()
);
export default store;
