import { CCard, CCardBody, CDataTable, CCollapse } from '@coreui/react';
import React, { useState } from 'react';
import moment from 'moment-timezone';
import { getHistoryTypeLabel } from './getHistoryTypeLabel';
import JSONPretty from 'react-json-pretty';

export default ({ content }) => {
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

  return (
    <>
      <div className="mb-2">
        <CCard>
          <CCardBody>
            <CDataTable
              items={content.history}
              fields={[{ key: 'date' }, { key: 'action' }, { key: 'user' }]}
              columnHeaderSlot={{
                date: <div style={{}}>Data</div>,
                action: <div style={{}}>Action</div>,
                user: <div style={{}}>User</div>
              }}
              size="sm"
              hover
              scopedSlots={{
                date: (historyItem) => <td>{moment(historyItem.createdAt).tz('Europe/Paris').format('YYYY/MM/DD HH:mm:ss')}</td>,
                action: (historyItem) => <td>{getHistoryTypeLabel(historyItem.type)}</td>,
                user: (historyItem) => <td>{historyItem.user}</td>,
                details: (historyItem, index) => (
                  <>
                    <CCollapse show={details.includes(index)}>
                      <CCardBody>
                        <JSONPretty id="json-pretty" data={historyItem.activity ?? {}}></JSONPretty>
                      </CCardBody>
                    </CCollapse>
                  </>
                )
              }}
              onRowClick={(item, index) => {
                toggleDetails(index);
              }}
            />
          </CCardBody>
        </CCard>
      </div>
    </>
  );
};
