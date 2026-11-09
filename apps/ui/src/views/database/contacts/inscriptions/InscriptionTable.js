import React, { useContext } from 'react';
import moment from 'moment-timezone';
import EmailingDatabaseApiContext from '../../../../contexts/EmailingDatabaseApiContext';
import { CBadge, CInput, CLink, CSelect, CSpinner } from '@coreui/react';
const DEFAULT_CELL_STYLE = { overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' };
export default ({ inscriptions, loading, showContactInfo, showSource = true, showStatus = true, filter, setFilter }) => {
  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);

  return (
    <div className="responsive-table">
      <table className="table table-sm">
        <thead>
          <tr>
            <th>Id</th>
            <th>InscriptionDate</th>
            {showContactInfo && <th>Email</th>}
            {showContactInfo && <th>Firstname</th>}

            {showContactInfo && <th>Lastname</th>}
            {showSource && <th>Source</th>}
            <th>CollectUrl</th>
            <th>New</th>
            <th>Activated</th>
            {showStatus && <th>Status</th>}
          </tr>
        </thead>
        {filter && setFilter && (
          <tbody>
            <tr>
              <td></td>
              <td></td>

              {showContactInfo && (
                <td>
                  <CInput
                    size="sm"
                    placeholder="Email"
                    value={filter.email ? filter.email : ''}
                    onChange={(e) => {
                      setFilter({ ...filter, email: e.target.value });
                    }}
                  ></CInput>
                </td>
              )}
              {showContactInfo && (
                <td>
                  <CInput
                    size="sm"
                    placeholder="Firstname"
                    value={filter.firstname ? filter.firstname : ''}
                    onChange={(e) => {
                      setFilter({ ...filter, firstname: e.target.value });
                    }}
                  ></CInput>
                </td>
              )}
              {
                <td>
                  <CInput
                    size="sm"
                    placeholder="Lastname"
                    value={filter.lastname ? filter.lastname : ''}
                    onChange={(e) => {
                      setFilter({ ...filter, lastname: e.target.value });
                    }}
                  ></CInput>
                </td>
              }
              {showSource && <td></td>}
              <td></td>
              <td>
                <CSelect
                  size="sm"
                  value={filter.isFirst ? filter.isFirst : ''}
                  onChange={(e) => {
                    setFilter({ ...filter, isFirst: e.target.value });
                  }}
                >
                  <option value=""></option>
                  <option value={true}>Yes</option>
                  <option value={false}>No</option>
                </CSelect>
              </td>
              <td>
                <CSelect
                  size="sm"
                  value={filter.activated ? filter.activated : ''}
                  onChange={(e) => {
                    setFilter({ ...filter, activated: e.target.value });
                  }}
                >
                  <option value=""></option>
                  <option value={true}>Yes</option>
                  <option value={false}>No</option>
                </CSelect>
              </td>
              {showStatus && <td></td>}
            </tr>
          </tbody>
        )}
        <tbody>
          {loading && (
            <tr>
              <td colSpan={5 + (showSource ? 1 : 0) + (showStatus ? 1 : 0) + (showContactInfo ? 3 : 0)}>
                <div style={{ textAlign: 'center', height: '160px' }}>
                  <CSpinner animation="grow" color="secondary" style={{ margin: 'auto' }} />
                </div>
              </td>
            </tr>
          )}
          {!loading && inscriptions.length === 0 && (
            <tr>
              <td colSpan={5 + (showSource ? 1 : 0) + (showStatus ? 1 : 0) + (showContactInfo ? 3 : 0)}>
                <div className="text-center w-100">... No data for this selection ...</div>
              </td>
            </tr>
          )}
          {!loading &&
            inscriptions.map((inscription, index) => {
              return (
                <tr key={index}>
                  <td>
                    <CLink to={`/${emailingDatabaseApiContext.getUid()}/contacts/inscriptions/list/${inscription.id}`}>#{inscription.id}</CLink>
                  </td>
                  <td>
                    <div style={{ width: '120px' }}>{moment(inscription.inscriptionDate).format('YYYY/MM/DD HH:mm')}</div>
                  </td>
                  {showContactInfo && (
                    <td>
                      <div style={{ ...DEFAULT_CELL_STYLE, width: '200px' }}>
                        <CLink to={`/${emailingDatabaseApiContext.getUid()}/contacts/list/${inscription.contact.id}`}> {inscription.contact.email}</CLink>
                      </div>
                    </td>
                  )}
                  {showContactInfo && (
                    <td>
                      <div style={{ ...DEFAULT_CELL_STYLE, width: '100px' }}>{inscription.fields && inscription.fields.firstname ? inscription.fields.firstname : ''}</div>
                    </td>
                  )}
                  {showContactInfo && (
                    <td>
                      <div style={{ ...DEFAULT_CELL_STYLE, width: '100px' }}>{inscription.fields && inscription.fields.lastname ? inscription.fields.lastname : ''}</div>
                    </td>
                  )}
                  {showSource && (
                    <td>
                      <div style={{ ...DEFAULT_CELL_STYLE, width: '100px' }}>{inscription.source ? inscription.source.name : inscription.sourceName}</div>
                    </td>
                  )}
                  <td>
                    <div style={{ ...DEFAULT_CELL_STYLE, width: '120px' }}>{inscription.collectUrl ? inscription.collectUrl : ''}</div>
                  </td>
                  <td>
                    <div style={{ ...DEFAULT_CELL_STYLE, width: '60px' }}>
                      <CBadge color={getActivatedBadge(inscription.isFirst)}>{inscription.isFirst ? 'Yes' : 'No'}</CBadge>
                    </div>
                  </td>
                  <td>
                    <div style={{ ...DEFAULT_CELL_STYLE, width: '60px' }}>
                      <CBadge color={getActivatedBadge(inscription.activated)}>{inscription.activated ? 'Yes' : 'No'}</CBadge>
                    </div>
                  </td>
                  {showStatus && (
                    <td>
                      <CBadge color={getContactStatusBadge(inscription.contact.status)}>{inscription.contact.status}</CBadge>
                    </td>
                  )}
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
};

const getActivatedBadge = (activated) => {
  switch (activated) {
    case true:
      return 'success';
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
