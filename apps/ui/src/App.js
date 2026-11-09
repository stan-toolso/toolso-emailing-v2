import React, { useState, useEffect } from 'react';
import { Route, Switch } from 'react-router-dom';
import { useHistory, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import EntrepriseSwitcher from './EntrepriseSwitcher';

import EmailingDatabaseApi from './services/EmailingDatabaseApi';
import StateService from './services/StateService';
import EmailingDatabaseApiContext from './contexts/EmailingDatabaseApiContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './scss/style.scss';

const loading = (
  <div className="pt-3 text-center">
    <div className="sk-spinner sk-spinner-pulse"></div>
  </div>
);

// Containers
const TheLayout = React.lazy(() => import('./containers/TheLayout'));

// Pages
const Login = React.lazy(() => import('./views/pages/Login'));
const Reset = React.lazy(() => import('./views/pages/Reset'));
const ChoosePassword = React.lazy(() => import('./views/pages/ChoosePassword'));
const Loader = React.lazy(() => import('./views/pages/Loader'));
let stateService = null;

export default () => {
  const [currentEmailingDatabaseApi, setCurrentEmailingDatabaseApi] = useState(null);
  const currentEmailingDatabase = useSelector((state) => state.currentEmailingDatabase);

  const stateReady = useSelector((state) => state.stateReady);

  useEffect(() => {
    setCurrentEmailingDatabaseApi(currentEmailingDatabase ? new EmailingDatabaseApi(currentEmailingDatabase) : null);
  }, [currentEmailingDatabase, setCurrentEmailingDatabaseApi]);

  if (!stateService) {
    const history = useHistory();
    const location = useLocation();
    stateService = new StateService(history, location, useDispatch());
  }

  return (
    <>
      <EmailingDatabaseApiContext.Provider value={currentEmailingDatabaseApi}>
        <React.Suspense fallback={loading}>
          {!stateReady && <Loader />}
          {stateReady && (
            <Switch>
              <Route exact path="/entreprise" name="EntrepriseSwitcher" render={(props) => <EntrepriseSwitcher {...props} />} />
              <Route exact path="/login" name="Login Page" render={(props) => <Login {...props} />} />
              <Route path="/join/:token" name="Join Page" render={(props) => <ChoosePassword {...props} />} />
              <Route path="/reset" name="Reset Request Page" render={(props) => <Reset {...props} />} />
              <Route path="/resetpassword/:token" name="Reset Page" render={(props) => <ChoosePassword {...props} />} />

              <Route path="/" name="Home" render={(props) => <TheLayout {...props} />} />
            </Switch>
          )}
        </React.Suspense>
      </EmailingDatabaseApiContext.Provider>
      <ToastContainer />
    </>
  );
};
