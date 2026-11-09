import React, { useEffect, useState } from 'react';

import { CButton, CCol, CFormGroup, CLabel, CModal, CModalBody, CModalFooter, CModalHeader, CRow, CSelect, CSpinner, CTextarea } from '@coreui/react';
import { toast } from 'react-toastify';
import { gql, useMutation } from '@apollo/client';
import { useSettings } from '../../../common/Settings';
import SendingConfigSelector from '../../sendings/SendingConfigSelector';

export default ({ defaultEmails, show, toggle, content, contentVersion }) => {
  const [sendingConfigId, setSendingConfigId] = useState(null);
  const [versionId, setVersionId] = useState(contentVersion ? contentVersion.id : content.versions[0].id);
  const [emails, setEmails] = useState(localStorage.getItem('contentSentTestModal-emails') ? localStorage.getItem('contentSentTestModal-emails') : defaultEmails ? defaultEmails.join('\n') : '');

  const [defaultContactMessageSendingConfigId] = useSettings('defaultContactMessageSendingConfigId');

  const [sendContentVersionTest, { loading }] = useMutation(gql`
    mutation sendContentVersionTest($emails: [String]!, $contentId: ID!, $versionId: ID!, $sendingConfigId: ID!) {
      sendContentVersionTest(emails: $emails, contentId: $contentId, versionId: $versionId, sendingConfigId: $sendingConfigId)
    }
  `);

  useEffect(() => {
    if (defaultContactMessageSendingConfigId) {
      setSendingConfigId(defaultContactMessageSendingConfigId);
    }
  }, [defaultContactMessageSendingConfigId, setSendingConfigId]);

  return (
    <CModal show={show} color="info" onClose={toggle}>
      <CModalHeader>Send test</CModalHeader>
      <CModalBody>
        <CRow>
          <CCol xl={12}>
            <CFormGroup>
              <CLabel htmlFor="emails">Emails</CLabel>
              <CTextarea
                id="emails"
                placeholder="Emails"
                style={{ height: '100px' }}
                required
                value={emails}
                onChange={(event) => {
                  setEmails(event.target.value);
                  localStorage.setItem('contentSentTestModal-emails', event.target.value);
                }}
              />
            </CFormGroup>
          </CCol>
          <CCol xl={12}>
            <CFormGroup>
              <CLabel htmlFor="templateSelector">Sending Config</CLabel>
              <SendingConfigSelector sendingConfigId={sendingConfigId} setSendingConfigId={setSendingConfigId} />
            </CFormGroup>
          </CCol>
          <CCol xl={12}>
            <CFormGroup>
              <CLabel htmlFor="templateSelector">Version</CLabel>
              <CSelect
                size="sm"
                value={versionId}
                onChange={(event) => {
                  setVersionId(event.target.value);
                }}
              >
                <option value=""> -- Select your version --</option>
                {content.versions.map((item, index) => {
                  return (
                    <option key={index} value={item.id}>
                      #{item.id} - {item.name}
                    </option>
                  );
                })}
              </CSelect>
            </CFormGroup>
          </CCol>
        </CRow>
      </CModalBody>
      <CModalFooter>
        <CButton onClick={toggle}>Cancel</CButton>
        <CButton
          color="info"
          onClick={async () => {
            let result = await sendContentVersionTest({
              variables: {
                emails: emails.split('\n'),
                contentId: content.id,
                versionId: versionId,
                sendingConfigId
              }
            });
            if (result && result.data.sendContentVersionTest) {
              for (let event of result.data.sendContentVersionTest.events) {
                toast.success(`Test sent to ${event.email}. MessageId is ${event.messageId}`, {
                  position: toast.POSITION.BOTTOM_RIGHT
                });
              }
              for (let error of result.data.sendContentVersionTest.errors) {
                toast.error(error.message, {
                  position: toast.POSITION.BOTTOM_RIGHT
                });
              }
              return;
            } else {
              toast.error('Failed to send test', {
                position: toast.POSITION.BOTTOM_RIGHT
              });
            }
          }}
        >
          {loading && <CSpinner color="secondary" />}
          Send Test
        </CButton>
      </CModalFooter>
    </CModal>
  );
};
