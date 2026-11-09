import React, { useCallback, useState } from 'react';

import { useSelector, useDispatch } from 'react-redux';
import { useHistory, useLocation } from 'react-router-dom';
import { emit } from '../services/AppEvents/AppEvents';
import { CDropdown, CDropdownItem, CDropdownMenu, CDropdownToggle } from '@coreui/react';
import { EventType } from '../services/AccessManager/AccessManager';

export default () => {
  const emailingDatabases = useSelector((state) => state.emailingDatabases);
  const currentEmailingDatabase = useSelector((state) => state.currentEmailingDatabase);
  const entrepriseFromRedux = useSelector((state) => state.entreprise);
  const user = useSelector((state) => state.user);
  const [enterprise, setEnterprise] = useState(entrepriseFromRedux);
  const location = useLocation();
  const history = useHistory();
  const dispatch = useDispatch();

  const toggleDatabase = useCallback(
    (emailerDatabase) => {
      return () => {
        if (!emailerDatabase) {
          history.push(`/`);
          return;
        }
        const paths = location.pathname.split('/');
        if (paths.length > 2) {
          paths[1] = emailerDatabase.uid;
          history.push(paths.join('/'));
        } else {
          history.push(`/${emailerDatabase.uid}/`);
        }
      };
    },
    [location, history]
  );

  const toggleEntreprise = useCallback(
    (userEntreprise) => {
      return () => {
        dispatch({ type: 'set', entreprise: userEntreprise.entreprise });
        dispatch({ type: 'set', userEntreprise });
        setEnterprise(userEntreprise.entreprise);
        emit(EventType.new_entreprise, userEntreprise.entreprise);
        emit(EventType.new_user_entreprise, userEntreprise);
        history.push(`/`);
      };
    },
    [dispatch, history]
  );

  let sortedEmailingDatabases = [];

  if (emailingDatabases && emailingDatabases.length > 0) {
    sortedEmailingDatabases = emailingDatabases.sort((a, b) => {
      return a.name > b.name ? 1 : -1;
    });
  }

  let sortedEnterprises = [...user.entreprises];
  let superAdmin = false;
  if (sortedEnterprises && sortedEnterprises.length > 0) {
    sortedEnterprises.sort((a, b) => {
      return a?.entreprise?.name > b?.entreprise?.name ? 1 : -1;
    });
    superAdmin = sortedEnterprises[0].role === 'superAdmin';
  }

  return (
    <div className="d-flex flex-row">
      {superAdmin && (
        <CDropdown>
          <CDropdownToggle
            caret
            style={{
              width: '95%',
              margin: '2px auto',
              color: '#23282c',
              backgroundColor: '#c8ced3',
              borderColor: '#c8ced3',
              display: 'block'
            }}
          >
            <span>{enterprise?.name}</span>
          </CDropdownToggle>
          <CDropdownMenu style={{ width: '95%' }}>
            {sortedEnterprises.map((item, index) => {
              return (
                <CDropdownItem key={index} onClick={toggleEntreprise(item)} className="pl-2">
                  {item.entreprise.name}
                </CDropdownItem>
              );
            })}
          </CDropdownMenu>
        </CDropdown>
      )}

      <CDropdown>
        <CDropdownToggle
          caret
          style={{
            width: '95%',
            margin: '2px auto',
            color: '#23282c',
            backgroundColor: '#c8ced3',
            borderColor: '#c8ced3',
            display: 'block'
          }}
        >
          {currentEmailingDatabase && <span>{currentEmailingDatabase.name}</span>}
          {!currentEmailingDatabase && <span>Home</span>}
        </CDropdownToggle>
        <CDropdownMenu style={{ width: '95%' }}>
          {currentEmailingDatabase && (
            <CDropdownItem onClick={toggleDatabase(null)}>
              <strong>Home</strong>
            </CDropdownItem>
          )}
          {(sortedEmailingDatabases.length >= 1 || !currentEmailingDatabase) && (
            <CDropdownItem header className="pl-2">
              Select your database
            </CDropdownItem>
          )}

          {sortedEmailingDatabases.map((item, index) => {
            if (!currentEmailingDatabase || currentEmailingDatabase.id !== item.id) {
              return (
                <CDropdownItem key={index} onClick={toggleDatabase(item)} className="pl-2">
                  {item.name}
                </CDropdownItem>
              );
            } else {
              return null;
            }
          })}
        </CDropdownMenu>
      </CDropdown>
    </div>
  );
};
