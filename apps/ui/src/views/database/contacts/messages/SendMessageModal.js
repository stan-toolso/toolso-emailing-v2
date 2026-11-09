import React, { useCallback, useEffect, useState } from 'react';
import { CButton, CCol, CFormGroup, CInput, CLabel, CModal, CModalBody, CModalFooter, CModalHeader, CRow, CSpinner } from '@coreui/react';
import TemplatesSelector from '../../contents/templates/TemplatesSelector';

import { toast } from 'react-toastify';

import AceEditor from 'react-ace';
import 'brace/ext/language_tools';
import 'ace-builds/src-noconflict/mode-html';
import 'ace-builds/src-noconflict/theme-github';
import TemplateVariablesEditor from '../../contents/templates/TemplateVariablesEditor';
import { gql, useMutation } from '@apollo/client';
import Mustache from 'mustache';
import SendingConfigSelector from '../../sendings/SendingConfigSelector';
import { useSettings } from '../../../common/Settings';

export default ({ email, show, toggle }) => {
  const [emails, setEmails] = useState(email ? email : '');
  const [subject, setSubject] = useState('');
  const [html, setHtml] = useState('');

  const [sendingConfigId, setSendingConfigId] = useState(null);
  const [contentTemplateId, setContentTemplateId] = useState(null);
  const [templateVariables, setTemplateVariables] = useState({});

  const [defaultContactMessageSendingConfigId] = useSettings('defaultContactMessageSendingConfigId');

  useEffect(() => {
    if (defaultContactMessageSendingConfigId) {
      setSendingConfigId(defaultContactMessageSendingConfigId);
    }
  }, [defaultContactMessageSendingConfigId, setSendingConfigId]);

  const setContentTemplate = useCallback(
    (contentTemplate) => {
      if (contentTemplate) {
        setSubject(contentTemplate.subject);
        setHtml(contentTemplate.html);
      }
    },
    [setHtml]
  );

  const [sendContactMessage, { loading }] = useMutation(gql`
    mutation sendContactMessage($emails: [String]!, $subject: String!, $senderName: String, $html: String!, $templateVariables: JSON, $sendingConfigId: ID!) {
      sendContactMessage(emails: $emails, subject: $subject, senderName: $senderName, html: $html, templateVariables: $templateVariables, sendingConfigId: $sendingConfigId)
    }
  `);

  return (
    <CModal show={show} color="info" onClose={toggle} size="xl">
      <CModalHeader>Send Message</CModalHeader>
      <CModalBody>
        <CRow>
          <CCol xl={6}>
            <CFormGroup>
              <CLabel htmlFor="templateSelector">Sending Config</CLabel>
              <SendingConfigSelector sendingConfigId={sendingConfigId} setSendingConfigId={setSendingConfigId} />
            </CFormGroup>
          </CCol>
          <CCol xl={6}>
            <CFormGroup>
              <CLabel htmlFor="emails">Emails</CLabel>
              <CInput size="sm" type="text" id="emails" placeholder="Emails" required value={emails} onChange={(event) => setEmails(event.target.value)} />
            </CFormGroup>
          </CCol>
        </CRow>
        <CRow>
          <CCol xl={12}>
            <CFormGroup>
              <CLabel htmlFor="templateSelector">Template</CLabel>
              <TemplatesSelector contentTemplateId={contentTemplateId} setContentTemplateId={setContentTemplateId} setContentTemplate={setContentTemplate} nullLabel="Custom template" />
            </CFormGroup>
          </CCol>
        </CRow>
        {contentTemplateId && (
          <CRow>
            <CCol xl={12}>
              <CFormGroup>
                <CLabel>Template variables</CLabel>
                <TemplateVariablesEditor variables={templateVariables} setVariables={setTemplateVariables} contentTemplateId={contentTemplateId} />
              </CFormGroup>
            </CCol>
          </CRow>
        )}

        {!contentTemplateId && (
          <CRow>
            <CCol xl={12}>
              <CFormGroup>
                <CLabel htmlFor="subject">Subject</CLabel>
                <CInput size="sm" type="text" id="subject" placeholder="Subject" required value={subject} onChange={(event) => setSubject(event.target.value)} />
              </CFormGroup>
            </CCol>

            <CCol xl={12}>
              <CFormGroup>
                <CLabel htmlFor="htmlTemplate">Template HTML</CLabel>

                <AceEditor
                  placeholder="Template HTML"
                  mode="html"
                  theme="github"
                  name="htmlTemplate"
                  className="form-control"
                  setOptions={{
                    enableBasicAutocompletion: true,
                    enableLiveAutocompletion: true,
                    enableSnippets: false,
                    showLineNumbers: true,
                    tabSize: 2
                  }}
                  onChange={setHtml}
                  fontSize={13}
                  showPrintMargin={false}
                  showGutter={true}
                  highlightActiveLine={true}
                  value={html}
                  style={{ width: '100%', height: '200px' }}
                />
              </CFormGroup>
            </CCol>
          </CRow>
        )}

        {contentTemplateId && (
          <CRow>
            <CCol xl={12}>
              <div style={{ fontWeight: 'bold' }}>Subject</div>
              <div className="pb-2" style={{ borderBottom: '1px solid #c8ced3' }}>
                {Mustache.render(subject, { content: templateVariables })}
              </div>
            </CCol>

            <CCol xl={12}>
              <iframe title="message-html" srcDoc={Mustache.render(html, { content: templateVariables })} style={{ border: 'none', height: '200px' }} className="w-100" />
            </CCol>
          </CRow>
        )}
      </CModalBody>
      <CModalFooter>
        <CButton onClick={toggle}>Cancel</CButton>
        <CButton
          color="info"
          onClick={async () => {
            let result = await sendContactMessage({
              variables: {
                emails: emails
                  .split(',')
                  .map((email) => {
                    return email.toLocaleLowerCase().trim();
                  })
                  .filter((email) => {
                    return email !== '';
                  }),
                subject,
                sendingConfigId,
                templateVariables,
                senderName: '',
                html
              }
            });
            if (result && result.data.sendContactMessage) {
              for (let email in result.data.sendContactMessage) {
                let event = result.data.sendContactMessage[email];
                if (event.messageId) {
                  toast.success(`Message sent to ${email}. MessageId is ${event.messageId}`, {
                    position: toast.POSITION.BOTTOM_RIGHT
                  });
                } else {
                  toast.error(`Failed to send message to ${email}.`, {
                    position: toast.POSITION.BOTTOM_RIGHT
                  });
                }
              }
              return;
            } else {
              toast.error('Failed to send BAT', {
                position: toast.POSITION.BOTTOM_RIGHT
              });
            }
          }}
        >
          {loading && <CSpinner color="secondary" />}
          Send Message
        </CButton>
      </CModalFooter>
    </CModal>
  );
};
