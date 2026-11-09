import React, { useState } from 'react';
import { CBadge, CButton, CCard, CCardBody, CCardHeader, CCol, CRow, CSpinner } from '@coreui/react';

import 'react-json-pretty/themes/monikai.css';
import { gql, useMutation, useQuery } from '@apollo/client';
import ContactDetail from '../ContactDetail';
import moment from 'moment-timezone';
import { getMessageStatusBadge } from './MessageUtil';
import SendMessageModal from './SendMessageModal';
import BlacklistedContactDetail from '../blacklistContacts/BlacklistedContactDetail';
import BlacklistContactModal from '../blacklistContacts/BlacklistContactModal';

export default ({ match }) => {
  const messageId = match.params.message_id;

  const [showSendMessageModal, setShowSendMessageModal] = useState(false);
  const [showBlacklistModal, setShowBlacklistModal] = useState(false);

  const { loading, data, refetch } = useQuery(
    gql`
      query contactMessage($id: ID!) {
        contactMessage(id: $id) {
          id
          date
          title
          message
          from
          to
          status
          sendFromToolso
          contact {
            id
          }
          blacklistedContact {
            id
          }
        }
      }
    `,
    {
      variables: {
        id: messageId
      }
    }
  );
  const message = data ? JSON.parse(JSON.stringify(data.contactMessage)) : null;

  const [updateContactMessage, { loading: loadingUpdate }] = useMutation(gql`
    mutation updateContactMessage($message: JSON!) {
      updateContactMessage(message: $message) {
        id
      }
    }
  `);

  return (
    <CRow className="inscription-detail">
      <CCol xl={12}>
        {message && (
          <SendMessageModal
            email={message ? message.from : null}
            show={showSendMessageModal}
            toggle={() => {
              setShowSendMessageModal(false);
            }}
          />
        )}
        {message && (
          <BlacklistContactModal
            defaultEmail={message.sendFromToolso ? message.to : message.from}
            show={showBlacklistModal}
            toggle={() => {
              setShowBlacklistModal(false);
            }}
          />
        )}

        <CCard>
          <CCardHeader>
            Message: #{messageId}
            {message && (
              <CButton
                size="sm"
                color="success"
                className="float-right mx-1"
                onClick={() => {
                  setShowSendMessageModal(true);
                }}
              >
                Answer
              </CButton>
            )}
            {message && ['pending'].includes(message.status) && (
              <CButton
                size="sm"
                color="success"
                className="float-right mx-1"
                onClick={async () => {
                  message.status = 'done';
                  await updateContactMessage({ variables: { message } });
                  refetch();
                }}
                disabled={loadingUpdate}
              >
                {loadingUpdate && <CSpinner color="secondary" size="sm" />}
                Mark as Done
              </CButton>
            )}
            {message && ['done'].includes(message.status) && (
              <CButton
                size="sm"
                color="warning"
                className="float-right"
                onClick={async () => {
                  message.status = 'pending';
                  await updateContactMessage({ variables: { message } });
                  refetch();
                }}
                disabled={loadingUpdate}
              >
                {loadingUpdate && <CSpinner color="secondary" size="sm" />}
                Mark as Pending
              </CButton>
            )}
          </CCardHeader>
          <CCardBody>
            {loading && (
              <div style={{ textAlign: 'center', padding: '30px 0px' }}>
                <CSpinner animation="grow" color="secondary" />
              </div>
            )}
            {!loading && message && (
              <>
                <CRow>
                  <CCol xl={6}>
                    <div style={{ fontWeight: 'bold' }}>From</div>
                    <div className="mb-2">{message.from}</div>
                    <div style={{ fontWeight: 'bold' }}>To</div>
                    <div className="pb-2">{message.to}</div>
                    <div style={{ fontWeight: 'bold' }}>Title</div>
                    <div className="pb-2">{message.title}</div>
                  </CCol>

                  <CCol xl={6}>
                    <div style={{ fontWeight: 'bold' }}>Status</div>
                    <div className="mb-2">
                      <CBadge color={getMessageStatusBadge(message.status)}>{message.status}</CBadge>
                    </div>
                    <div style={{ fontWeight: 'bold' }}>Date</div>
                    <div className="mb-2">{moment(message.date).format('YYYY/MM/DD HH:mm:ss')}</div>
                  </CCol>
                </CRow>
                <div style={{ borderBottom: '1px solid #c8ced3' }}></div>
                <CRow>
                  <CCol xl={12}>
                    <iframe title="message-html" srcDoc={message.message} style={{ border: 'none', height: '200px' }} className="w-100" />
                  </CCol>
                </CRow>
              </>
            )}
          </CCardBody>
        </CCard>
        {!loading && message && message.contact && <ContactDetail contactId={message.contact.id} />}
        {!loading && message && !message.contact && (
          <CCard>
            <CCardHeader>Contact information</CCardHeader>
            <CCardBody>
              <span>No contact information for email {message.sendFromToolso ? message.to : message.from}.</span>
            </CCardBody>
          </CCard>
        )}

        {!loading && message && (
          <CCard>
            <CCardHeader>
              Blacklist information
              {!message.blacklistedContact && (
                <CButton
                  size="sm"
                  color="danger"
                  className="float-right mx-1"
                  onClick={() => {
                    setShowBlacklistModal(true);
                    refetch();
                  }}
                >
                  Blacklist Contact
                </CButton>
              )}
            </CCardHeader>
            <CCardBody>
              {!message.blacklistedContact && <span>Contact {message.sendFromToolso ? message.to : message.from} is not blacklisted.</span>}

              {message.blacklistedContact && <BlacklistedContactDetail id={message.blacklistedContact.id} unblacklistCallback={refetch}></BlacklistedContactDetail>}
            </CCardBody>
          </CCard>
        )}
      </CCol>
    </CRow>
  );
};
