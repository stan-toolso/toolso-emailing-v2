import React from 'react';
import { CBadge, CCard, CCardBody, CCol, CRow, CSpinner } from '@coreui/react';
import moment from 'moment-timezone';

import { gql, useQuery } from '@apollo/client';
import { getTypeBadge } from './utils';

import JSONPretty from 'react-json-pretty';
import 'react-json-pretty/themes/monikai.css';

export default ({ match }) => {
  const eventId = match.params.event_id;

  const { data, loading } = useQuery(
    gql`
      query contactEvent($id: ID!) {
        contactEvent(id: $id) {
          id
          type
          date
          requestDate
          messageId
          details
          content {
            name
          }
          schedule {
            name
          }
          contact {
            id
            email
          }
          sender {
            id
            name
            email
          }
          ipAddress {
            id
            ip
            name
            domain
          }
        }
      }
    `,
    {
      variables: {
        id: eventId
      }
    }
  );

  const contactEvent = data ? data.contactEvent : null;

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
            {!loading && contactEvent && (
              <>
                <table className="table table-striped table-hover table-sm">
                  <tbody>
                    <tr>
                      <td>Contact Event ID</td>
                      <td>
                        <strong>{contactEvent.id}</strong>
                      </td>
                    </tr>
                    <tr>
                      <td>Event Type</td>
                      <td>
                        <strong>
                          <CBadge color={getTypeBadge(contactEvent.type)}>{contactEvent.type}</CBadge>
                        </strong>
                      </td>
                    </tr>
                    <tr>
                      <td>Message ID</td>
                      <td>
                        <strong>{contactEvent.messageId}</strong>
                      </td>
                    </tr>

                    <tr>
                      <td>Event date</td>
                      <td>
                        <strong>{moment(contactEvent.date).format('YYYY/MM/DD HH:mm:ss')}</strong>
                      </td>
                    </tr>
                    <tr>
                      <td>Request date</td>
                      <td>
                        <strong>{moment(contactEvent.requestDate).format('YYYY/MM/DD HH:mm:ss')}</strong>
                      </td>
                    </tr>
                    <tr>
                      <td>Schedule</td>
                      <td>
                        <strong>{contactEvent.schedule ? contactEvent.schedule.name : ''}</strong>
                      </td>
                    </tr>
                    <tr>
                      <td>Content</td>
                      <td>
                        <strong>{contactEvent.content ? contactEvent.content.name : ''}</strong>
                      </td>
                    </tr>
                    <tr>
                      <td>Sender</td>
                      <td>
                        <strong>{contactEvent.sender ? contactEvent.sender.email : ''}</strong>
                      </td>
                    </tr>

                    <tr>
                      <td>IpAddress</td>
                      <td>
                        <strong>{contactEvent.ipAddress ? `${contactEvent.ipAddress.name}-${contactEvent.ipAddress.ip ? contactEvent.ipAddress.ip : ''}` : ''}</strong>
                      </td>
                    </tr>
                    <tr>
                      <td>Details</td>
                      <td>
                        <JSONPretty style={{ background: '#FFF !important' }} id="json-pretty" data={contactEvent.details ? contactEvent.details : {}}></JSONPretty>
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
