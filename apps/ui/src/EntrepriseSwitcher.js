import { gql, useMutation, useQuery } from '@apollo/client';
import { CCard, CCardBody, CCardHeader, CCol, CContainer, CRow, CSpinner } from '@coreui/react';
import React, { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { getSignedClient, EventType } from './services/AccessManager/AccessManager';

import { emit } from './services/AppEvents/AppEvents';
import { useHistory } from 'react-router-dom';
import { Col } from 'react-bootstrap';
import { Button } from 'react-bootstrap';

const ME = gql`
  query me {
    me {
      entreprises {
        id
        pending
        disabled
        role
        entreprise {
          id
          name
          settings
        }
      }
    }
  }
`;

export default () => {
  const { loading, data, refetch } = useQuery(ME, {
    client: getSignedClient()
  });
  const dispatch = useDispatch();

  const history = useHistory();

  const setUserEntreprise = useCallback(
    (userEntreprise) => {
      dispatch({ type: 'set', entreprise: userEntreprise.entreprise });
      dispatch({ type: 'set', userEntreprise });
      emit(EventType.new_entreprise, userEntreprise.entreprise);
      emit(EventType.new_user_entreprise, userEntreprise);
      history.push(`/`);
    },
    [dispatch, history]
  );
  if (data && data.me && data.me.entreprises && data.me.entreprises.length === 1 && !data.me.entreprises[0].pending) {
    //only 1 approved entreprise, we can select it.
    setUserEntreprise(data.me.entreprises[0].entreprise);
  }

  let sortedEntreprises = data?.me?.entreprises ? [...data?.me?.entreprises] : [];
  sortedEntreprises.sort((a, b) => a?.entreprise?.name?.localeCompare(b?.entreprise?.name));
  return (
    <div className="c-app c-default-layout flex-row align-items-center">
      <CContainer>
        <CRow className="justify-content-center">
          <CCol md="6">
            <CCard>
              <CCardHeader>Select your enterprise account</CCardHeader>
              <CCardBody>
                {loading && (
                  <div style={{ textAlign: 'center', padding: '30px 0px' }}>
                    <CSpinner animation="grow" color="secondary" />
                  </div>
                )}

                {!loading &&
                  sortedEntreprises?.length > 0 &&
                  sortedEntreprises.map(function (entreprise, index) {
                    if (entreprise.pending) {
                      return <PendingEntreprise entreprise={entreprise} onUpdate={refetch} key={index} />;
                    } else {
                      return (
                        <div
                          style={{ cursor: 'pointer' }}
                          key={index}
                          className="hover-light py-3 px-4 w-100 border-bottom"
                          onClick={() => {
                            setUserEntreprise(entreprise);
                          }}
                        >
                          <i className="fas pt-1 fa-caret-right float-right"></i>
                          {entreprise.entreprise.name}
                        </div>
                      );
                    }
                  })}
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>
      </CContainer>
    </div>
  );
};

const PendingEntreprise = ({ entreprise, onUpdate }) => {
  const [acceptUserEntreprise] = useMutation(
    gql`
      mutation acceptUserEntreprise($input: AcceptUserEntrepriseInput!) {
        acceptUserEntreprise(input: $input) {
          userEntreprise {
            id
            role
            disabled
            pending
          }
        }
      }
    `,
    {
      client: getSignedClient()
    }
  );

  const [ignoreUserEntreprise] = useMutation(
    gql`
      mutation ignoreUserEntreprise($input: IgnoreUserEntrepriseInput!) {
        ignoreUserEntreprise(input: $input)
      }
    `,
    {
      client: getSignedClient()
    }
  );

  return (
    <div className="row py-3 px-4 w-100 border-bottom">
      <Col sm="8">{entreprise.entreprise.name}</Col>
      <Col sm="2">
        <Button
          size="sm"
          variant="primary"
          onClick={async () => {
            await acceptUserEntreprise({
              variables: {
                input: {
                  id: entreprise.id
                }
              }
            });
            onUpdate();
          }}
          style={{ width: '100%' }}
        >
          Join
        </Button>
      </Col>
      <Col sm="2">
        <Button
          size="sm"
          variant="danger"
          onClick={async () => {
            await ignoreUserEntreprise({
              variables: {
                input: {
                  id: entreprise.id
                }
              }
            });
            onUpdate();
          }}
          style={{ width: '100%' }}
        >
          Ignore
        </Button>
      </Col>
    </div>
  );
};
