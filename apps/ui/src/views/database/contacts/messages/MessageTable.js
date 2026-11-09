import React, { useContext, useState } from 'react';
import moment from 'moment-timezone';
import EmailingDatabaseApiContext from '../../../../contexts/EmailingDatabaseApiContext';
import { CBadge, CFormGroup, CInput, CInputCheckbox, CLink, CSelect, CSpinner } from '@coreui/react';
import { getMessageStatusBadge } from './MessageUtil';
const DEFAULT_CELL_STYLE = {
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis'
};
export default ({ messages, loading, showContactInfo, filter, setFilter, setMessages }) => {
  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);

  const [allSelected, setAllSelected] = useState(false);

  return (
    <div className="table-responsive">
      <table className="table table-sm">
        <thead>
          <tr>
            <th>
              <div style={{ width: '30px' }}>
                <CFormGroup variant="checkbox" className="checkbox" inline>
                  <CInputCheckbox
                    size="sm"
                    id="day1"
                    checked={allSelected}
                    onChange={() => {
                      for (let message of messages) {
                        message.checked = !allSelected;
                      }
                      setMessages(messages);

                      setAllSelected(!allSelected);
                    }}
                  />
                </CFormGroup>
              </div>
            </th>
            <th>
              <div style={{ width: '50px' }}>ID</div>
            </th>
            <th>
              <div style={{ width: '80px' }}>Date</div>
            </th>
            <th>
              <div style={{ width: '80px' }}>Status</div>
            </th>
            {showContactInfo && (
              <th>
                <div style={{ width: '150px' }}>From</div>
              </th>
            )}
            <th style={{ width: '150px' }}>
              <div className="w-100">Title</div>
            </th>
            <th style={{ width: '100%' }}>
              <div className="w-100">Message</div>
            </th>
          </tr>
        </thead>
        {filter && setFilter && (
          <tbody>
            <tr>
              <td></td>
              <td></td>
              <td>
                <div style={{ ...DEFAULT_CELL_STYLE, width: '80px' }}></div>
              </td>
              <td>
                <div style={{ ...DEFAULT_CELL_STYLE, width: '80px' }}>
                  <CSelect
                    style={{ width: '80px' }}
                    size="sm"
                    type="select"
                    value={filter.status ? filter.status : ''}
                    onChange={(e) => {
                      setFilter({ ...filter, status: e.target.value });
                    }}
                  >
                    <option value=""> -- All --</option>
                    <option value="pending">Pending</option>
                    <option value="done">Done</option>
                  </CSelect>
                </div>
              </td>

              {showContactInfo && (
                <td>
                  <div style={{ ...DEFAULT_CELL_STYLE, width: '150px' }}>
                    <CInput
                      size="sm"
                      placeholder="From"
                      value={filter.from ? filter.from : ''}
                      onChange={(e) => {
                        setFilter({ ...filter, from: e.target.value });
                      }}
                    ></CInput>
                  </div>
                </td>
              )}
              <td>
                <div style={{ ...DEFAULT_CELL_STYLE, width: '150px' }}>&nbsp;</div>
              </td>
              <td>
                <div style={{ ...DEFAULT_CELL_STYLE, width: '100%' }}>&nbsp;</div>
              </td>
            </tr>
          </tbody>
        )}
        <tbody>
          {loading && (
            <tr>
              <td colSpan={6 + (showContactInfo ? 1 : 0)}>
                <div style={{ textAlign: 'center', height: '160px' }}>
                  <CSpinner animation="grow" color="secondary" style={{ margin: 'auto' }} />
                </div>
              </td>
            </tr>
          )}
          {!loading && messages.length === 0 && (
            <tr>
              <td colSpan={6 + (showContactInfo ? 1 : 0)}>
                <div className="text-center w-100">... No data for this selection ...</div>
              </td>
            </tr>
          )}
          {!loading &&
            messages.map((message, index) => {
              return (
                <tr key={index} className={message.status === 'pending' ? 'font-weight-bold' : ''}>
                  <td>
                    <div style={{ ...DEFAULT_CELL_STYLE, width: '30px' }}>
                      <CFormGroup variant="checkbox" className="checkbox" inline>
                        <CInputCheckbox
                          size="sm"
                          id="day1"
                          checked={message.checked ? message.checked : false}
                          onChange={() => {
                            message.checked = message.checked ? false : true;
                            setMessages(messages);
                          }}
                        />
                      </CFormGroup>
                    </div>
                  </td>
                  <td>
                    <div style={{ ...DEFAULT_CELL_STYLE, width: '50px' }}>
                      <CLink to={`/${emailingDatabaseApiContext.getUid()}/contacts/messages/list/${message.id}`}>#{message.id}</CLink>
                    </div>
                  </td>

                  <td>
                    <div style={{ ...DEFAULT_CELL_STYLE, width: '80px' }}>
                      {moment(message.date).isSame(moment(), 'day') ? moment(message.date).format('HH:mm') : moment(message.date).format('YYYY-MM-DD HH:mm')}
                    </div>
                  </td>
                  <td>
                    <div style={{ ...DEFAULT_CELL_STYLE, width: '80px' }}>
                      <CBadge color={getMessageStatusBadge(message.status)}>{message.status}</CBadge>
                    </div>
                  </td>
                  {showContactInfo && (
                    <td>
                      <div style={{ ...DEFAULT_CELL_STYLE, width: '150px' }}>{message.from}</div>
                    </td>
                  )}

                  <td>
                    <div style={{ ...DEFAULT_CELL_STYLE, width: '150px' }}>{message.title ? message.title : ''}</div>
                  </td>
                  <td>
                    <div
                      style={{
                        ...DEFAULT_CELL_STYLE,
                        width: '100%',
                        maxWidth: '600px'
                      }}
                    >
                      {message.extract ? message.extract : ''}
                    </div>
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
};
