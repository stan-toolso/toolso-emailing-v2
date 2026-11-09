import React, { useContext } from 'react';
import { CButton, CCard, CCardBody, CCol, CRow, CSpinner } from '@coreui/react';

import { gql, useMutation, useQuery } from '@apollo/client';

import JSONPretty from 'react-json-pretty';
import 'react-json-pretty/themes/monikai.css';
import { toast } from 'react-toastify';
import EmailingDatabaseApiContext from '../../../../contexts/EmailingDatabaseApiContext';
import { useHistory } from 'react-router';

export default ({ id, match, unblacklistCallback }) => {
  if (!id) {
    id = match.params.id;
  }

  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);
  const history = useHistory();

  const { data, loading } = useQuery(
    gql`
      query blacklistedContact($id: ID!) {
        blacklistedContact(id: $id) {
          id
          email
          sha1
          sha256
          md5
          stats
          history
        }
      }
    `,
    {
      variables: {
        id
      }
    }
  );

  const [unblacklist, { loading: loadingUnblacklist }] = useMutation(gql`
    mutation unblacklist($id: ID!) {
      unblacklist(id: $id)
    }
  `);

  const blacklistedContact = data ? data.blacklistedContact : null;

  return (
    <CRow className="contact-detail">
      <CCol xl={12}>
        <CCard>
          <CCardBody className="p-0">
            {loading && (
              <div style={{ textAlign: 'center', padding: '30px 0px' }}>
                <CSpinner animation="grow" color="secondary" />
              </div>
            )}
            {!loading && blacklistedContact && (
              <>
                <table className="table table-striped table-hover table-sm">
                  <tbody>
                    <tr>
                      <td>
                        <div className="m-2">ID</div>
                      </td>
                      <td>
                        <strong>{blacklistedContact.id}</strong>
                        <CButton
                          size="sm"
                          color="danger"
                          className="m-2"
                          onClick={async () => {
                            await unblacklist({
                              variables: {
                                id
                              }
                            });
                            toast.success(`Contact unblacklisted`, {
                              position: toast.POSITION.BOTTOM_RIGHT
                            });
                            if (unblacklistCallback) {
                              unblacklistCallback();
                            } else {
                              history.push(`/${emailingDatabaseApiContext.getUid()}/contacts/blacklist/`);
                            }
                          }}
                          disabled={loadingUnblacklist}
                        >
                          {loadingUnblacklist && <CSpinner color="secondary" size="sm" />}
                          UnBlacklist
                        </CButton>
                      </td>
                    </tr>

                    <tr>
                      <td>Email</td>
                      <td>
                        <strong>{blacklistedContact.email}</strong>
                      </td>
                    </tr>

                    <tr>
                      <td>Md5</td>
                      <td>
                        <strong>{blacklistedContact.md5}</strong>
                      </td>
                    </tr>

                    <tr>
                      <td>Sha1</td>
                      <td>
                        <strong>{blacklistedContact.sha1}</strong>
                      </td>
                    </tr>

                    <tr>
                      <td>Sha256</td>
                      <td>
                        <strong>{blacklistedContact.sha256}</strong>
                      </td>
                    </tr>

                    <tr>
                      <td>Stats</td>
                      <td>
                        <JSONPretty style={{ background: '#FFF !important' }} id="json-pretty" data={blacklistedContact.stats ? blacklistedContact.stats : {}}></JSONPretty>
                      </td>
                    </tr>
                    <tr>
                      <td>History</td>
                      <td>
                        <JSONPretty style={{ background: '#FFF !important' }} id="json-pretty" data={blacklistedContact.history ? blacklistedContact.history : {}}></JSONPretty>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </>
            )}
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  );
};
