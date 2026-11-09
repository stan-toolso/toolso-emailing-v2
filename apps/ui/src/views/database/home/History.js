import React, { useState, useEffect, useContext } from 'react';
import { CCard, CCardHeader, CCardBody, CSelect, CDataTable, CFormGroup, CLabel, CLink, CBadge, CCollapse, CSpinner } from '@coreui/react';
import moment from 'moment-timezone';
import 'react-confirm-alert/src/react-confirm-alert.css'; // Import css
import { gql, useQuery } from '@apollo/client';
import Pagination from '../../common/Pagination';
import EmailingDatabaseApiContext from '../../../contexts/EmailingDatabaseApiContext';
import JSONPretty from 'react-json-pretty';

export default () => {
  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);
  const [history, setHistory] = useState([]);
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(50);
  const [total, setTotal] = useState(0);
  const [type, setType] = useState(0);
  const [details, setDetails] = useState([]);

  const toggleDetails = (index) => {
    const position = details.indexOf(index);
    let newDetails = details.slice();
    if (position !== -1) {
      newDetails.splice(position, 1);
    } else {
      newDetails = [...details, index];
    }
    setDetails(newDetails);
  };

  const { data, loading, refetch } = useQuery(
    gql`
      query GetHistory($limit: Int, $offset: Int) {
        getHistory(limit: $limit, offset: $offset) {
          total
          history {
            activity
            createdAt
            id
            ressource_id
            ressource_type
            type
            user
            log_level
            need_notification
          }
        }
      }
    `,
    {
      variables: {
        limit: limit,
        offset: offset
      }
    }
  );

  useEffect(() => {
    if (data) {
      setHistory(data.getHistory.history);
      setTotal(data?.getHistory?.total ? data.getHistory.total : 0);
    }
  }, [data, setHistory]);

  function getTypeLabel(type) {
    switch (type) {
      case 'content_suspension':
        return 'Content Suspension';
      case 'sendingConfig_updateConfigScore':
        return 'Sending Config Score Updated';
      case 'sendingConfig_update':
        return 'Sending Config Updated';
      case 'content_activation':
        return 'Content Activation';
      case 'content_deactivation':
        return 'Content Deactivation';
      case 'esp_exclusion':
        return 'Esp Exclusion';
      case 'content_suspension_recommendation':
        return 'Content Suspension Recommendation';
      case 'schedule_update':
        return 'Schedule Updated';
      default:
        return type;
    }
  }

  let filteredHistory = type ? history?.filter((historyItem) => historyItem.type === type) : history;

  return (
    <>
      <CCard>
        <CCardHeader>
          History{' '}
          <div className="mb-0 float-right" style={{ display: 'inline-block', minWidth: total >= 20 ? '310px' : '200px' }}>
            <Pagination offset={offset} limit={limit} total={total} setOffset={setOffset} setLimit={setLimit} />
          </div>
          <CFormGroup className="float-right" style={{ display: 'inline-block' }}>
            <CLabel className="mr-2">Event Types</CLabel>
            <CSelect
              style={{ display: 'inline-block', width: '120px' }}
              className="form-control mr-2"
              size="sm"
              onChange={(event) => {
                setType(event.target.value);
              }}
              value={type}
            >
              <option value={''} key="default">
                All Types
              </option>
              <option value={'content_suspension'} key="content_suspension">
                Content Suspension
              </option>
              <option value={'content_activation'} key="content_activation">
                Content Activation
              </option>
              <option value={'content_deactivation'} key="content_deactivation">
                Content Deactivation
              </option>
              <option value={'content_suspension_recommendation'} key="content_suspension_recommendation">
                Content Suspension Recommendation
              </option>
              <option value={'esp_exclusion'} key="esp_exclusion">
                Esp Exclusion
              </option>
              <option value={'schedule_update'} key="schedule_update">
                Schedule Updated
              </option>
              <option value={'sendingConfig_updateConfigScore'} key="sendingConfig_updateConfigScore">
                Sending Config Score Updated
              </option>
              <option value={'sendingConfig_update'} key="sendingConfig_update">
                Sending Config Updated
              </option>
            </CSelect>
          </CFormGroup>
        </CCardHeader>
        <CCardBody>
          {loading && <CSpinner color="secondary" />}
          {!loading && (
            <>
              <CDataTable
                items={loading ? null : filteredHistory}
                fields={[{ key: 'type' }, { key: 'ressource_id' }, { key: 'user' }, { key: 'createdAt' }, { key: 'log_level' }]}
                columnHeaderSlot={{
                  type: <div style={{}}>Type</div>,
                  ressource_id: <div style={{}}>Ressource Id</div>,
                  user: <div style={{}}>User</div>,
                  createdAt: <div style={{}}>Date</div>,
                  log_level: <div style={{}}>LogLevel</div>
                }}
                size="sm"
                hover
                sorter
                loading={loading}
                scopedSlots={{
                  type: (historyItem) => (
                    <td>
                      <div>
                        {getTypeLabel(historyItem.type)} &nbsp;
                        {historyItem.need_notification && (
                          <CBadge color="warning" style={{ display: 'inline', marginLeft: '2px' }}>
                            new
                          </CBadge>
                        )}
                      </div>
                    </td>
                  ),
                  ressource_id: (historyItem) => (
                    <td>
                      <div>{getRessourceLink(emailingDatabaseApiContext, historyItem)}</div>
                    </td>
                  ),
                  user: (historyItem) => (
                    <td>
                      <div>{historyItem.user}</div>
                    </td>
                  ),
                  createdAt: (historyItem) => <td>{historyItem.createdAt ? moment(historyItem.createdAt).format('YYYY/MM/DD HH:mm:ss') : ''}</td>,
                  log_level: (historyItem) => (
                    <td>
                      <div>{historyItem.log_level}</div>
                    </td>
                  ),
                  details: (historyItem, index) => (
                    <>
                      <tr></tr>
                      <CCollapse show={details.includes(index)}>
                        <CCardBody>
                          <JSONPretty id="json-pretty" data={historyItem.activity ?? {}}></JSONPretty>
                        </CCardBody>
                      </CCollapse>
                    </>
                  )
                }}
                onRowClick={(item, index) => {
                  markAsRead(emailingDatabaseApiContext, item, refetch);
                  toggleDetails(index);
                }}
              />
              <div className="mb-0 px-2">
                <Pagination offset={offset} limit={limit} total={total} setOffset={setOffset} setLimit={setLimit} />
              </div>
            </>
          )}
        </CCardBody>
      </CCard>
    </>
  );
};

function getRessourceLink(emailingDatabaseApiContext, historyItem) {
  if (historyItem?.ressource_type) {
    if (historyItem.ressource_type === 'content') {
      return <CLink to={`/${emailingDatabaseApiContext.getUid()}/contents/list/${historyItem.ressource_id}`}> {historyItem.ressource_id}</CLink>;
    }
    if (historyItem.ressource_type === 'sendingConfig') {
      return <CLink to={`/${emailingDatabaseApiContext.getUid()}/sendings/settings/configs`}> {historyItem.ressource_id}</CLink>;
    }
    if (historyItem.ressource_type === 'schedule') {
      return <CLink to={`/${emailingDatabaseApiContext.getUid()}/sendings/schedules/recurrent/${historyItem.ressource_id}`}> {historyItem.ressource_id}</CLink>;
    }
  }
  return historyItem.ressource_id;
}

async function markAsRead(emailingDatabaseApiContext, item, refetch) {
  if (item.need_notification) {
    try {
      await emailingDatabaseApiContext.doMutation({
        mutation: gql`
          mutation MarkHistoryAsRead($id: ID!) {
            markHistoryAsRead(id: $id) {
              id
              need_notification
            }
          }
        `,
        variables: { id: item.id }
      });
      refetch();
    } catch (err) {
      console.error(`cannot update mark as read status for notification #${item?.id}`);
    }
  }
}
