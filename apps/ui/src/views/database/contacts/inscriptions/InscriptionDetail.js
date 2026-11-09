import React, { useContext } from 'react';
import { CCard, CCardBody, CCardHeader, CCol, CLink, CRow, CSpinner } from '@coreui/react';

import EmailingDatabaseApiContext from '../../../../contexts/EmailingDatabaseApiContext';
import moment from 'moment-timezone';
import JSONPretty from 'react-json-pretty';
import 'react-json-pretty/themes/monikai.css';
import { gql, useQuery } from '@apollo/client';

export default ({ match }) => {
  const inscriptionId = match.params.inscription_id;
  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);

  const { loading, data } = useQuery(
    gql`
      query contactInscription($id: ID!) {
        contactInscription(id: $id) {
          id
          inscriptionDate
          fields
          collectUrl
          isFirst
          isFirstToday
          activated
          ip
          contact {
            id
            email
            status
          }
          source {
            id
            name
          }
          sourceName
        }
      }
    `,
    {
      variables: {
        id: inscriptionId
      }
    }
  );
  const inscription = data ? data.contactInscription : null;
  return (
    <CRow className="inscription-detail">
      <CCol xl={12}>
        <CCard>
          <CCardHeader>Inscription: {inscriptionId}</CCardHeader>
          <CCardBody>
            {loading && (
              <div style={{ textAlign: 'center', padding: '30px 0px' }}>
                <CSpinner animation="grow" color="secondary" />
              </div>
            )}
            {!loading && inscription && (
              <table className="table table-striped table-hover">
                <tbody>
                  <tr>
                    <td>Inscription ID</td>
                    <td>
                      <strong>{inscription.id}</strong>
                    </td>
                  </tr>
                  <tr>
                    <td>Contact ID</td>
                    <td>
                      <strong>
                        <CLink target="_blank" to={`/${emailingDatabaseApiContext.getUid()}/contacts/list/${inscription.contact.id}`}>
                          {inscription.contact.id}
                        </CLink>
                      </strong>
                    </td>
                  </tr>
                  <tr>
                    <td>Inscription Date</td>
                    <td>
                      <strong>{moment(inscription.inscriptionDate).format('YYYY/MM/DD HH:mm:ss')}</strong>
                    </td>
                  </tr>
                  <tr>
                    <td>Collect URL</td>
                    <td>
                      <strong>{inscription.collectUrl}</strong>
                    </td>
                  </tr>
                  <tr>
                    <td>Collect IP</td>
                    <td>
                      <strong>{inscription.ip}</strong>
                    </td>
                  </tr>
                  <tr>
                    <td>Source Name</td>
                    <td>
                      <strong>{inscription.sourceName}</strong>
                    </td>
                  </tr>
                  <tr>
                    <td>Source mapped</td>
                    <td>
                      <strong>{inscription.source ? inscription.source.name : 'none'}</strong>
                    </td>
                  </tr>
                  <tr>
                    <td>Is new</td>
                    <td>
                      <strong>{inscription.isFirst ? 'yes' : 'no'}</strong>
                    </td>
                  </tr>
                  <tr>
                    <td>Is new today</td>
                    <td>
                      <strong>{inscription.isFirstToday ? 'yes' : 'no'}</strong>
                    </td>
                  </tr>
                  <tr>
                    <td>Activated</td>
                    <td>
                      <strong>{inscription.activated ? 'yes' : 'no'}</strong>
                    </td>
                  </tr>
                  <tr>
                    <td>fields</td>
                    <td>
                      <JSONPretty style={{ background: '#FFF !important' }} id="json-pretty" data={inscription.fields ? inscription.fields : {}}></JSONPretty>
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  );
};
