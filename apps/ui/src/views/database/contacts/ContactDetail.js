import React from 'react';
import { CBadge, CButton, CCard, CCardBody, CCardHeader, CCol, CRow, CSpinner } from '@coreui/react';

import { gql, useMutation, useQuery } from '@apollo/client';

import { useSelector } from 'react-redux';
import moment from 'moment-timezone';
import JSONPretty from 'react-json-pretty';
import 'react-json-pretty/themes/monikai.css';
import ContactInscriptions from './ContactInscriptions';
import ContactEvents from './ContactEvents';

const getBlacklistedBadge = (blacklisted) => {
  switch (blacklisted) {
    case true:
      return 'danger';
    default:
      return 'secondary';
  }
};

const getActivatedBadge = (activated) => {
  switch (activated) {
    case true:
      return 'success';
    default:
      return 'secondary';
  }
};

const getPixelTrackingConsentBadge = (pixelTrackingConsent) => {
  switch (pixelTrackingConsent) {
    case true:
      return 'success';
    case false:
      return 'danger';
    default:
      return 'secondary';
  }
};

const getContactStatusBadge = (status) => {
  switch (status) {
    case 'workable':
      return 'success';
    case 'unsub':
      return 'warning';
    case 'complaint':
    case 'hard_bounce':
    case 'blacklisted':
      return 'danger';
    default:
      return 'secondary';
  }
};

export default ({ contactId, match }) => {
  if (!contactId) {
    contactId = match.params.contact_id;
  }

  const user = useSelector((state) => state.user);

  const { data, loading, refetch } = useQuery(
    gql`
      query contact($id: ID!) {
        contact(id: $id) {
          id
          email
          firstname
          lastname
          dob
          street
          city
          zipcode
          activated
          blacklisted
          pixelTrackingConsent
          status
          gender
          activityScore
          customFields
          customScores
          stats
          nextStatusUpdateDate
          lastStatusUpdateQueuedDate
          statusQueued
          lastInscription {
            id
            inscriptionDate
            source {
              id
              name
            }
          }
        }
      }
    `,
    {
      variables: {
        id: contactId
      }
    }
  );

  const [unsubscribe, { loading: loadingUnsub }] = useMutation(gql`
    mutation UnsubscribeContact($id: ID!) {
      unsubscribeContact(id: $id) {
        id
      }
    }
  `);

  const [blacklistContact, { loading: loadingBlacklist }] = useMutation(gql`
    mutation blacklistContact($id: ID!, $origin: String!, $reason: String!) {
      blacklistContact(id: $id, origin: $origin, reason: $reason) {
        id
      }
    }
  `);

  const [unblacklistContact, { loading: loadingUnblacklist }] = useMutation(gql`
    mutation unblacklistContact($id: ID!) {
      unblacklistContact(id: $id)
    }
  `);

  const [subscribe, { loading: loadingSub }] = useMutation(gql`
    mutation SubscribeContact($id: ID!) {
      subscribeContact(id: $id) {
        id
      }
    }
  `);

  const contact = data ? data.contact : null;

  return (
    <CRow className="contact-detail">
      <CCol xl={12}>
        <CCard>
          <CCardHeader>
            Contact: {contactId}
            {!loading && contact && (
              <>
                {['workable', 'archived', 'new'].includes(contact.status) && (
                  <CButton
                    size="sm"
                    color="danger"
                    className="float-right ml-1"
                    onClick={async () => {
                      await unsubscribe({ variables: { id: contact.id } });
                      refetch();
                    }}
                    disabled={loadingUnsub}
                  >
                    {loadingUnsub && <CSpinner color="secondary" size="sm" />}
                    Unsubscribe
                  </CButton>
                )}
                {!contact.blacklisted && !['workable', 'archived', 'new'].includes(contact.status) && (
                  <CButton
                    size="sm"
                    color="success"
                    className="float-right ml-1"
                    onClick={async () => {
                      await subscribe({ variables: { id: contact.id } });
                      refetch();
                    }}
                    disabled={loadingSub}
                  >
                    {loadingSub && <CSpinner color="secondary" size="sm" />}
                    Subscribe
                  </CButton>
                )}
                {!contact.blacklisted && (
                  <CButton
                    size="sm"
                    color="danger"
                    className="float-right ml-1"
                    onClick={async () => {
                      await blacklistContact({
                        variables: {
                          id: contact.id,
                          origin: `Toolso Emailing Website - Contact detail - Blacklisted by ${user.email}`,
                          reason: ''
                        }
                      });
                      refetch();
                    }}
                    disabled={loadingBlacklist}
                  >
                    {loadingBlacklist && <CSpinner color="secondary" size="sm" />}
                    Blacklist
                  </CButton>
                )}
                {contact.blacklisted && (
                  <CButton
                    size="sm"
                    color="success"
                    className="float-right ml-1"
                    onClick={async () => {
                      await unblacklistContact({
                        variables: {
                          id: contact.id
                        }
                      });
                      refetch();
                    }}
                    disabled={loadingUnblacklist}
                  >
                    {loadingUnblacklist && <CSpinner color="secondary" size="sm" />}
                    UnBlacklist
                  </CButton>
                )}
              </>
            )}
          </CCardHeader>
          <CCardBody>
            {loading && (
              <div style={{ textAlign: 'center', padding: '30px 0px' }}>
                <CSpinner animation="grow" color="secondary" />
              </div>
            )}
            {!loading && contact && (
              <>
                <table className="table table-striped table-hover">
                  <tbody>
                    <tr>
                      <td>Contact ID</td>
                      <td>
                        <strong>{contact.id}</strong>
                      </td>
                    </tr>
                    <tr>
                      <td>Email</td>
                      <td>
                        <strong>{contact.email}</strong>
                      </td>
                    </tr>
                    <tr>
                      <td>Gender</td>
                      <td>
                        <strong>{contact.gender}</strong>
                      </td>
                    </tr>
                    <tr>
                      <td>Firstname</td>
                      <td>
                        <strong>{contact.firstname}</strong>
                      </td>
                    </tr>
                    <tr>
                      <td>Lastname</td>
                      <td>
                        <strong>{contact.lastname}</strong>
                      </td>
                    </tr>
                    <tr>
                      <td>Birthday</td>
                      <td>
                        <strong>{contact.dob ? moment(contact.dob).format('YYYY/MM/DD') : ''}</strong>
                      </td>
                    </tr>
                    <tr>
                      <td>Street</td>
                      <td>
                        <strong>{contact.street}</strong>
                      </td>
                    </tr>
                    <tr>
                      <td>Zipcode</td>
                      <td>
                        <strong>{contact.zipcode}</strong>
                      </td>
                    </tr>
                    <tr>
                      <td>City</td>
                      <td>
                        <strong>{contact.city}</strong>
                      </td>
                    </tr>

                    <tr>
                      <td>Status</td>
                      <td>
                        <strong>
                          <CBadge color={getContactStatusBadge(contact.status)}>{contact.status}</CBadge>
                        </strong>
                      </td>
                    </tr>
                    <tr>
                      <td>Next Status Update</td>
                      <td>
                        <strong>{contact.nextStatusUpdateDate ? moment(contact.nextStatusUpdateDate).format('YYYY-MM-DD HH:mm:ss') : ''}</strong>
                      </td>
                    </tr>
                    <tr>
                      <td>Last Status Update</td>
                      <td>
                        <strong>{contact.lastStatusUpdateQueuedDate ? moment(contact.lastStatusUpdateQueuedDate).format('YYYY-MM-DD HH:mm:ss') : ''}</strong>
                      </td>
                    </tr>
                    <tr>
                      <td>Activity Score</td>
                      <td>
                        <strong>{contact.activityScore}</strong>
                      </td>
                    </tr>
                    <tr>
                      <td>Click Quality Score</td>
                      <td>
                        <strong>{contact.customScores?.clickQualityScore}</strong>
                      </td>
                    </tr>
                    {contact.customScores?.complaintRiskScore && (
                      <tr>
                        <td>Complaint Risk Score</td>
                        <td>
                          <strong>{contact.customScores?.complaintRiskScore}</strong>
                        </td>
                      </tr>
                    )}

                    <tr>
                      <td>Activated</td>
                      <td>
                        <strong>
                          <CBadge color={getActivatedBadge(contact.activated)}>{contact.activated ? 'yes' : 'no'}</CBadge>
                        </strong>
                      </td>
                    </tr>
                    <tr>
                      <td>Blacklisted</td>
                      <td>
                        <strong>
                          <CBadge color={getBlacklistedBadge(contact.blacklisted)}>{contact.blacklisted ? 'yes' : 'no'}</CBadge>
                        </strong>
                      </td>
                    </tr>
                    <tr>
                      <td>Pixel Tracking Consent</td>
                      <td>
                        <strong>
                          <CBadge color={getPixelTrackingConsentBadge(contact.pixelTrackingConsent)}>
                            {contact.pixelTrackingConsent === false ? 'refused' : contact.pixelTrackingConsent === true ? 'accepted' : 'unknown'}
                          </CBadge>
                        </strong>
                      </td>
                    </tr>

                    <tr>
                      <td>CustomFields</td>
                      <td>
                        <JSONPretty id="json-pretty" data={contact.customFields ? contact.customFields : {}}></JSONPretty>
                      </td>
                    </tr>

                    <tr>
                      <td>Event stats</td>
                      <td>
                        <JSONPretty id="json-pretty" data={contact.stats ? contact.stats : {}}></JSONPretty>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <ContactInscriptions contactId={contactId} />
                <ContactEvents contactId={contactId} />
              </>
            )}
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  );
};
