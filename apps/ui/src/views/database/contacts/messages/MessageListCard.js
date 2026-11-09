import React, { useState } from 'react';

import { CButton, CCard, CCardBody, CCardHeader, CCol, CRow } from '@coreui/react';
import MessageList from './MessageList';
import SendMessageModal from './SendMessageModal';

export default () => {
  const [showSendMessageModal, setShowSendMessageModal] = useState(false);
  return (
    <CRow>
      <CCol xl={12}>
        <SendMessageModal
          show={showSendMessageModal}
          toggle={() => {
            setShowSendMessageModal(false);
          }}
        />

        <CCard>
          <CCardHeader>
            Messages
            <CButton
              size="sm"
              color="primary"
              className="float-right"
              onClick={() => {
                setShowSendMessageModal(true);
              }}
            >
              New Message
            </CButton>
          </CCardHeader>
          <CCardBody>
            <MessageList />
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  );
};
