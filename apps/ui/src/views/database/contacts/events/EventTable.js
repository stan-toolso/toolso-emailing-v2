import React, { useContext } from 'react';
import moment from 'moment-timezone';
import { CBadge, CInput, CLink, CSelect, CSpinner } from '@coreui/react';
import EmailingDatabaseApiContext from '../../../../contexts/EmailingDatabaseApiContext';
import { getTypeBadge } from './utils';

const DEFAULT_CELL_STYLE = { overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' };

export default ({ events, loading, showContactInfo, filter, setFilter }) => {
  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);

  return (
    <div className="responsive-table">
      <table className="table table-sm">
        <thead>
          <tr>
            <th>ID</th>
            <th>Date</th>
            {showContactInfo && <th>Email</th>}
            <th>Type</th>
            <th>Message ID</th>
            <th>Schedule</th>
            <th>Content</th>
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
              <td>
                <CSelect
                  size="sm"
                  value={filter.type ? filter.type : ''}
                  onChange={(e) => {
                    setFilter({ ...filter, type: e.target.value });
                  }}
                >
                  <option value=""></option>
                  <option value="request">Request</option>
                  <option value="no_request">NoRequest</option>
                  <option value="delivered">Delivered</option>
                  <option value="open">Open</option>
                  <option value="click">Click</option>
                  <option value="proxy_loaded">Proxy loaded</option>
                  <option value="unsub">Unsub</option>
                  <option value="complaint">Complaint</option>
                  <option value="hard_bounce">Hard Bounce</option>
                  <option value="soft_bounce">Soft bounce</option>
                  <option value="contact_bounce">Contact bounce</option>
                  <option value="content_bounce">Content bounce</option>
                </CSelect>
              </td>
              <td>
                <CInput
                  size="sm"
                  placeholder="Message ID"
                  value={filter.messageId ? filter.messageId : ''}
                  onChange={(e) => {
                    setFilter({ ...filter, messageId: e.target.value });
                  }}
                ></CInput>
              </td>
              <td></td>
              <td></td>
            </tr>
          </tbody>
        )}
        <tbody>
          {loading && (
            <tr>
              <td colSpan={5 + (showContactInfo ? 1 : 0)}>
                <div style={{ textAlign: 'center', height: '160px' }}>
                  <CSpinner animation="grow" color="secondary" style={{ margin: 'auto' }} />
                </div>
              </td>
            </tr>
          )}
          {!loading && events.length === 0 && (
            <tr>
              <td colSpan={5 + (showContactInfo ? 1 : 0)}>
                <div className="text-center w-100">... No data for this selection ...</div>
              </td>
            </tr>
          )}
          {!loading &&
            events.map((event, index) => {
              return (
                <tr key={index}>
                  <td>
                    <CLink to={`/${emailingDatabaseApiContext.getUid()}/contacts/events/list/${event.id}`}>#{event.id}</CLink>
                  </td>

                  <td>
                    <div style={{ width: '120px' }}>{moment(event.date).format('YYYY/MM/DD HH:mm')}</div>
                  </td>
                  {showContactInfo && (
                    <td>
                      <div style={{ ...DEFAULT_CELL_STYLE, width: '200px' }}>
                        <CLink to={`/${emailingDatabaseApiContext.getUid()}/contacts/list/${event.contact.id}`}> {event.contact.email}</CLink>
                      </div>
                    </td>
                  )}
                  <td>
                    <div style={{ width: '60px' }}>
                      <CBadge color={getTypeBadge(event.type)}>{event.type}</CBadge>
                    </div>
                  </td>
                  <td>
                    <div style={{ ...DEFAULT_CELL_STYLE, width: '200px' }}>{event.messageId}</div>
                  </td>
                  <td>
                    <div style={{ ...DEFAULT_CELL_STYLE, maxWidth: '120px' }}>{event.schedule ? event.schedule.name : ''}</div>
                  </td>
                  <td>
                    <div style={{ ...DEFAULT_CELL_STYLE, maxWidth: '250px' }}>{event.content ? event.content.name : ''}</div>
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
};
