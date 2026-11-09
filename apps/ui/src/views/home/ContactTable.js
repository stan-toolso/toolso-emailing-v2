import { CBadge, CButton, CFormGroup, CInput, CInputCheckbox, CLink, CSpinner } from '@coreui/react';
import moment from 'moment';
import React, { useCallback, useState } from 'react';
import { confirmContactsRemove } from './confirmContactsRemove';

export const ContactTable = ({ contacts, total, filter, setAndActiveFilter, setContacts, removeContacts, isLoading }) => {
  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === 'Enter') {
        setAndActiveFilter({ ...filter });
      }
    },
    [filter, setAndActiveFilter]
  );

  const [email, setEmail] = useState('');
  const [firstname, setFirstname] = useState('');
  const [lastname, setLastname] = useState('');

  const [allSelected, setAllSelected] = useState(false);

  return (
    <div className="responsive-table">
      <table className="table table-sm">
        <thead>
          <tr>
            <th>
              <CFormGroup variant="checkbox" className="checkbox" inline>
                <CInputCheckbox
                  size="sm"
                  id="day1"
                  checked={allSelected}
                  onChange={() => {
                    for (let contact of contacts) {
                      contact.checked = !allSelected;
                    }
                    setContacts([...contacts]);

                    setAllSelected(!allSelected);
                  }}
                />
              </CFormGroup>
            </th>
            <th>Database</th>
            <th>Id</th>
            <th>Inscription Date</th>
            <th>Email</th>
            <th>Firstname</th>
            <th>Lastname</th>
            <th>Activated</th>
            <th>Status</th>
            <th>Blacklisted</th>
          </tr>
        </thead>
        {filter && setAndActiveFilter && (
          <tbody>
            <tr>
              <td></td>
              <td></td>
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
              <td></td>
            </tr>
            <tr>
              <td colSpan={10}>
                <div className="text-center w-100">
                  <CButton
                    size="sm"
                    className="px-5"
                    color="primary"
                    onClick={async () => {
                      setAndActiveFilter({ ...filter });
                    }}
                  >
                    Search
                  </CButton>
                </div>
              </td>
            </tr>
          </tbody>
        )}
        <tbody>
          {isLoading() && (
            <tr>
              <td colSpan={10}>
                <div style={{ textAlign: 'center', height: '30px' }}>
                  <CSpinner animation="grow" color="secondary" style={{ margin: 'auto' }} />
                </div>
              </td>
            </tr>
          )}
          {!isLoading() && contacts.length === 0 && (
            <tr>
              <td colSpan={10}>
                <div className="text-center w-100">... {Object.keys(filter).length > 0 ? 'No data for this selection' : 'Start your search to see the results'} ...</div>
              </td>
            </tr>
          )}
          {!isLoading() && contacts.length > 0 && (
            <tr>
              <td colSpan={10}>
                <div className="text-center w-100">... {total} contacts found for this selection ...</div>
              </td>
            </tr>
          )}

          {contacts &&
            contacts.map((contact, index) => {
              return (
                <tr key={index}>
                  <td>
                    <div style={{ width: '30px' }}>
                      <CFormGroup variant="checkbox" className="checkbox" inline>
                        <CInputCheckbox
                          size="sm"
                          checked={contact.checked ? contact.checked : false}
                          onChange={() => {
                            contact.checked = contact.checked ? false : true;
                            setContacts([...contacts]);
                          }}
                        />
                      </CFormGroup>
                    </div>
                  </td>
                  <td>
                    <div>{contact.database.name}</div>
                  </td>
                  <td>
                    <CLink to={`/${contact.database.uid}/contacts/list/${contact.id}`}>#{contact.id}</CLink>
                  </td>
                  <td>
                    <div style={{ width: '120px' }}>
                      {contact.lastInscription && contact.lastInscription.inscriptionDate ? moment(contact.lastInscription.inscriptionDate).format('YYYY/MM/DD HH:mm') : ''}
                    </div>
                  </td>
                  <td>
                    <div style={{ ...DEFAULT_CELL_STYLE, width: '200px' }}>
                      <CLink to={`/${contact.database.uid}/contacts/list/${contact.id}`}> {contact.email}</CLink>
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
                    <CBadge color={getBlacklistedBadge(contact.blacklisted)}>{contact.blacklisted ? 'Yes' : 'No'}</CBadge>
                  </td>
                  <td>
                    <i
                      className="pl-2 pr-1 fas  fa-trash"
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        let contactsToRemove = [contact];

                        confirmContactsRemove(contactsToRemove, () => {
                          removeContacts(contactsToRemove);
                        });
                      }}
                    ></i>
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
};

const DEFAULT_CELL_STYLE = {
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis'
};

const getActivatedBadge = (activated) => {
  switch (activated) {
    case true:
      return 'success';
    default:
      return 'secondary';
  }
};

const getBlacklistedBadge = (blacklisted) => {
  switch (blacklisted) {
    case true:
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
