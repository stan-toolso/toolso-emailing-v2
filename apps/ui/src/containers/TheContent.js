import React, { Suspense, useContext } from 'react';
import { Redirect, Route, Switch } from 'react-router-dom';
import { CContainer, CFade } from '@coreui/react';
import { ApolloProvider } from '@apollo/client';

import EmailingDatabaseApiContext from '../contexts/EmailingDatabaseApiContext';

// routes config

import routes from '../routes';
import emailingRoutes from '../emailingRoutes';

const loading = (
  <div className="pt-3 text-center">
    <div className="sk-spinner sk-spinner-pulse"></div>
  </div>
);

const TheContent = () => {
  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);

  const getTo = (match, redirect) => {
    if (match.params) {
      Object.keys(match.params).map((key) => {
        redirect = redirect.replace(`:${key}`, match.params[key]);
        return key;
      });
    }
    return redirect;
  };

  return (
    <main className="c-main">
      <CContainer fluid>
        <Suspense fallback={loading}>
          <>
            {!emailingDatabaseApiContext && (
              <Switch>
                {routes.map((route, idx) => {
                  return (
                    route.component && (
                      <Route
                        key={idx}
                        path={route.path}
                        exact={route.exact}
                        name={route.name}
                        render={(props) => (
                          <CFade>
                            <route.component {...props} />
                          </CFade>
                        )}
                      />
                    )
                  );
                })}
              </Switch>
            )}
            {emailingDatabaseApiContext && (
              <ApolloProvider client={emailingDatabaseApiContext.getClient()}>
                <Switch>
                  {emailingRoutes.map((route, idx) => {
                    if (route.redirect) {
                      return <Route key={idx} path={route.path} exact={route.exact} name={route.name} render={(match) => <Redirect to={getTo(match.match, route.redirect)} />} />;
                    }

                    return (
                      route.component && (
                        <Route
                          key={idx}
                          path={route.path}
                          exact={route.exact}
                          name={route.name}
                          render={(props) => (
                            <CFade>
                              <route.component {...props} />
                            </CFade>
                          )}
                        />
                      )
                    );
                  })}
                </Switch>
              </ApolloProvider>
            )}
          </>
        </Suspense>
      </CContainer>
    </main>
  );
};

export default React.memo(TheContent);
