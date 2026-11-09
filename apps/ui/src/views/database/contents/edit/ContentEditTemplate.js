import React, { useState, useContext, useCallback } from 'react';
import { CButton, CCol, CFormGroup, CInput, CLabel, CRow, CSpinner } from '@coreui/react';
import { updateContentVersion } from '../util';
import TemplatesSelector from '../templates/TemplatesSelector';
import TemplateVariablesEditor from '../templates/TemplateVariablesEditor';
import EmailingDatabaseApiContext from '../../../../contexts/EmailingDatabaseApiContext';
import AceEditor from 'react-ace';
import 'brace/ext/language_tools';
import 'ace-builds/src-noconflict/mode-html';
import 'ace-builds/src-noconflict/theme-github';
import InsertCodeModal from './InsertCodeModal';
import ContentSendTestModal from './ContentSendTestModal';
import { useSelector } from 'react-redux';
import { extractTemplateVariables } from '../templates/TemplateUtil';
import { useQuery } from '@apollo/client';
import gql from 'graphql-tag';
import { useSettings } from '../../../common/Settings';

export default ({ contentVersion, content, forceUpdate }) => {
  const [canEditSenderName] = useSettings('canEditSenderName');
  const [versionName, setVersionName] = useState(contentVersion.name ? contentVersion.name : '');
  const [subject, setSubject] = useState(contentVersion.subject ? contentVersion.subject : '');
  const [senderName, setSenderName] = useState(contentVersion.senderName ? contentVersion.senderName : '');
  const [frenchEspsSubject, setFrenchEspsSubject] = useState(contentVersion.frenchEspsSubject ? contentVersion.frenchEspsSubject : '');
  const [html, setHtml] = useState(contentVersion.html ? contentVersion.html : '');
  const [previewText, setPreviewText] = useState(contentVersion.previewText ? contentVersion.previewText : '');
  const [showModal, setShowModal] = useState(false);

  const [showSendTestModal, setShowSendTestModal] = useState(false);
  const user = useSelector((state) => state.user);

  const [contentTemplateId, setContentTemplateId] = useState(contentVersion.contentTemplate ? contentVersion.contentTemplate.id : null);
  const [templateVariables, setTemplateVariables] = useState(contentVersion.templateVariables ? contentVersion.templateVariables : {});

  const [saving, setSaving] = useState(false);
  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);

  const { data: templateParts } = useQuery(
    gql`
      query contentTemplateParts($limit: Int, $offset: Int, $filter: JSON) {
        contentTemplateParts(limit: $limit, offset: $offset, filter: $filter) {
          contentTemplateParts {
            uid
            html
          }
        }
      }
    `,
    {
      variables: {
        limit: 1000,
        offset: 0,
        filter: {}
      }
    }
  );

  const contentVariables = extractTemplateVariables(html, templateVariables, templateParts && templateParts.contentTemplateParts ? templateParts.contentTemplateParts.contentTemplateParts : []);

  const switchToCustomTemplate = useCallback(() => {
    setHtml(contentVersion.contentTemplate.html);
    setSubject(contentVersion.contentTemplate.subject);
    setSenderName(contentVersion.contentTemplate.senderName);
    setFrenchEspsSubject(contentVersion.contentTemplate.frenchEspsSubject);
    setPreviewText(contentVersion.contentTemplate.previewText);
    setTemplateVariables({ ...templateVariables });
    setContentTemplateId(null);
  }, [contentVersion, templateVariables, setHtml, setSubject, setSenderName, setFrenchEspsSubject, setPreviewText, setContentTemplateId, setTemplateVariables]);

  const replaceWithKitMapping = (aKitMapping, anHtml) => {
    let result = anHtml;
    if (aKitMapping) {
      Object.keys(aKitMapping).map((kitMappingKey) => {
        result = result.replaceAll(kitMappingKey, aKitMapping[kitMappingKey]);
      });
    }
    return result;
  };

  return (
    <>
      <InsertCodeModal
        show={showModal}
        html={html}
        setHtml={setHtml}
        toggle={() => {
          setShowModal(false);
        }}
      />

      {content.versions.length > 1 && (
        <CRow>
          <CCol xl={12}>
            <CFormGroup>
              <CLabel htmlFor="versionName">Version name</CLabel>
              <CInput size="sm" type="text" id="versionName" placeholder="Version Name" required value={versionName} onChange={(event) => setVersionName(event.target.value)} />
            </CFormGroup>
          </CCol>
        </CRow>
      )}

      <CRow>
        <CCol xl={12}>
          <CFormGroup>
            <CLabel htmlFor="templateSelector">Template</CLabel>
            <TemplatesSelector contentTemplateId={contentTemplateId} setContentTemplateId={setContentTemplateId} nullLabel="Custom template" />
            {contentTemplateId && (
              <a
                style={{ color: 'blue', textDecoration: 'underline', cursor: 'pointer' }}
                onClick={() => {
                  switchToCustomTemplate();
                }}
              >
                switch to custom template
              </a>
            )}
          </CFormGroup>
        </CCol>
      </CRow>
      {(contentTemplateId || (contentVariables && contentVariables.length > 0)) && (
        <CRow>
          <CCol xl={12}>
            <CFormGroup>
              <CLabel>Used Template variables</CLabel>
              <TemplateVariablesEditor
                variables={templateVariables}
                setVariables={setTemplateVariables}
                contentTemplateId={contentTemplateId}
                used={true}
                templateParts={templateParts && templateParts.contentTemplateParts ? templateParts.contentTemplateParts.contentTemplateParts : []}
                html={html}
                subject={subject}
                frenchEspssubject={frenchEspsSubject}
                previewText={previewText}
                senderName={senderName}
              />
            </CFormGroup>
            {contentTemplateId && (
              <CFormGroup>
                <TemplateVariablesEditor
                  variables={templateVariables}
                  setVariables={setTemplateVariables}
                  contentTemplateId={contentTemplateId}
                  used={false}
                  templateParts={templateParts && templateParts.contentTemplateParts ? templateParts.contentTemplateParts.contentTemplateParts : []}
                />
              </CFormGroup>
            )}
          </CCol>
        </CRow>
      )}
      {!contentTemplateId && (
        <CRow>
          {canEditSenderName && (
            <CCol xl={12}>
              <CFormGroup>
                <CLabel htmlFor="senderName">Sender name (not used for french ESPs)</CLabel>
                <CInput size="sm" type="text" id="senderName" placeholder="Sender Name" required value={senderName} onChange={(event) => setSenderName(event.target.value)} />
              </CFormGroup>
            </CCol>
          )}

          <CCol xl={12}>
            <CFormGroup>
              <CLabel htmlFor="subject">Subject</CLabel>
              <CInput size="sm" type="text" id="subject" placeholder="Subject" required value={subject} onChange={(event) => setSubject(event.target.value)} />
            </CFormGroup>
          </CCol>
          {canEditSenderName && (
            <CCol xl={12}>
              <CFormGroup>
                <CLabel htmlFor="frenchEspsSubject">French Esps Subject</CLabel>
                <CInput
                  size="sm"
                  type="text"
                  id="frenchEspsSubject"
                  placeholder="FrenchEspsSubject"
                  required
                  value={frenchEspsSubject}
                  onChange={(event) => setFrenchEspsSubject(event.target.value)}
                />
              </CFormGroup>
            </CCol>
          )}
          <CCol xl={12}>
            <CFormGroup>
              <CLabel htmlFor="previewText">Preview Text</CLabel>
              <CInput size="sm" type="text" id="previewText" placeholder="Preview Text" value={previewText} onChange={(event) => setPreviewText(event.target.value)} />
            </CFormGroup>
          </CCol>
          <CCol xl={12}>
            <CFormGroup>
              <CButton
                size="sm"
                color="primary"
                className="float-right  ml-2 mb-1"
                onClick={() => {
                  setShowModal(true);
                }}
              >
                Insert code
              </CButton>
              {content?.partner?.kitMapping && (
                <CButton
                  size="sm"
                  color="primary"
                  className="float-right mb-1"
                  onClick={() => {
                    setHtml(replaceWithKitMapping(content?.partner?.kitMapping, html));
                  }}
                >
                  Apply Kit Mapping
                </CButton>
              )}

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
                style={{ width: '100%' }}
              />
            </CFormGroup>
          </CCol>
        </CRow>
      )}

      <CRow>
        <CCol xl={12}>
          <CButton
            className="mr-2"
            size="sm"
            color="primary"
            onClick={async () => {
              setSaving(true);
              await updateContentVersion(
                emailingDatabaseApiContext,
                contentVersion,
                { name: versionName, subject, frenchEspsSubject, html, contentTemplateId, templateVariables, previewText, senderName },
                'Template has been saved',
                forceUpdate
              );
              setSaving(false);
            }}
          >
            {saving && <CSpinner as="span" animation="grow" size="sm" role="status" aria-hidden="true" color="secondary" />}
            Save
          </CButton>

          <CButton
            className="mr-2"
            size="sm"
            color="success"
            onClick={() => {
              setShowSendTestModal(true);
            }}
          >
            Send Test
          </CButton>
        </CCol>
      </CRow>
      <ContentSendTestModal
        defaultEmails={[user.email]}
        content={content}
        contentVersion={contentVersion}
        show={showSendTestModal}
        toggle={() => {
          setShowSendTestModal(false);
        }}
      />
    </>
  );
};
