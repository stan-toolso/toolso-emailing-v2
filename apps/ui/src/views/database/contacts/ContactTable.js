import React, { useCallback, useContext, useState } from 'react';
import EmailingDatabaseApiContext from '../../../contexts/EmailingDatabaseApiContext';
import { CBadge, CInput, CLink, CSelect, CSpinner } from '@coreui/react';

import moment from 'moment-timezone';
import { formatInteger } from '../../util';

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
      return 'danger';
    default:
      return 'secondary';
  }
};

const DEFAULT_CELL_STYLE = { overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' };

export default ({ contacts, loading, filter, setFilter }) => {
  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === 'Enter') {
        setFilter({ ...filter });
      }
    },
    [filter, setFilter]
  );

  const [email, setEmail] = useState('');
  const [firstname, setFirstname] = useState('');
  const [lastname, setLastname] = useState('');
  const [consent, setConsent] = useState('');

  return (
    <div className="responsive-table">
      <table className="table table-sm">
        <thead>
          <tr>
            <th>Id</th>
            <th>Inscription Date</th>
            <th>Email</th>
            <th>Firstname</th>
            <th>Lastname</th>
            <th>Activated</th>
            <th>Status</th>
            <th>Score</th>
            <th>Tracking Consent</th>
          </tr>
        </thead>
        {filter && setFilter && (
          <tbody>
            <tr>
              <td></td>
              <td></td>
              <td>
                <CInput
                  size="sm"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => {
                    filter.email = e.target.value;
                    setEmail(e.target.value);
                  }}
                  onKeyDown={handleKeyDown}
                ></CInput>
              </td>
              <td>
                <CInput
                  size="sm"
                  placeholder="Firstname"
                  value={firstname}
                  onChange={(e) => {
                    filter.firstname = e.target.value;
                    setFirstname(e.target.value);
                  }}
                  onKeyDown={handleKeyDown}
                ></CInput>
              </td>
              <td>
                <CInput
                  size="sm"
                  placeholder="Lastname"
                  value={lastname}
                  onChange={(e) => {
                    filter.lastname = e.target.value;
                    setLastname(e.target.value);
                  }}
                  onKeyDown={handleKeyDown}
                ></CInput>
              </td>
              <td></td>
              <td></td>
              <td></td>
              <td>
                <CSelect
                  size="sm"
                  value={consent}
                  onChange={(e) => {
                    filter.pixelTrackingConsent = e.target.value;
                    setConsent(e.target.value);
                    setFilter({ ...filter });
                  }}
                >
                  <option value="">All</option>
                  <option value="true">Accepted</option>
                  <option value="false">Refused</option>
                  <option value="null">Unknown</option>
                </CSelect>
              </td>
            </tr>
          </tbody>
        )}
        <tbody>
          {loading && (
            <tr>
              <td colSpan={9}>
                <div style={{ textAlign: 'center', height: '160px' }}>
                  <CSpinner animation="grow" color="secondary" style={{ margin: 'auto' }} />
                </div>
              </td>
            </tr>
          )}
          {!loading && contacts.length === 0 && (
            <tr>
              <td colSpan={9}>
                <div className="text-center w-100">... No data for this selection ...</div>
              </td>
            </tr>
          )}
          {!loading &&
            contacts.map((contact, index) => {
              return (
                <tr key={index}>
                  <td>
                    <CLink to={`/${emailingDatabaseApiContext.getUid()}/contacts/list/${contact.id}`}>#{contact.id}</CLink>
                  </td>
                  <td>
                    <div style={{ width: '120px' }}>
                      {contact.lastInscription && contact.lastInscription.inscriptionDate ? moment(contact.lastInscription.inscriptionDate).format('YYYY/MM/DD HH:mm') : ''}
                    </div>
                  </td>
                  <td>
                    <div style={{ ...DEFAULT_CELL_STYLE, width: '200px' }}>
                      <CLink to={`/${emailingDatabaseApiContext.getUid()}/contacts/list/${contact.id}`}> {contact.email}</CLink>
                    </div>
                  </td>
                  <td>
                    <div>{contact.firstname}</div>
                  </td>
                  <td>
                    <div>{contact.lastname}</div>
                  </td>
                  <td>
                    <CBadge color={getActivatedBadge(contact.activated)}>{contact.activated ? 'Yes' : 'No'}</CBadge>
                  </td>
                  <td>
                    <CBadge color={getContactStatusBadge(contact.status)}>{contact.status}</CBadge>
                  </td>
                  <td>
                    <div>{formatInteger(contact.activityScore)}</div>
                  </td>
                  <td>
                    <CBadge color={getPixelTrackingConsentBadge(contact.pixelTrackingConsent)}>
                      {contact.pixelTrackingConsent === false ? 'refused' : contact.pixelTrackingConsent === true ? 'accepted' : 'unknown'}
                    </CBadge>
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
};
