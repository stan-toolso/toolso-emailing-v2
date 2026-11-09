import React, { useState, useEffect } from 'react';
import { CButton, CCol, CFormGroup, CInput, CLabel, CRow, CSpinner } from '@coreui/react';
import AceEditor from 'react-ace';
import 'brace/ext/language_tools';
import 'ace-builds/src-noconflict/mode-html';
import 'ace-builds/src-noconflict/theme-github';
import CampaignManagerApi from '../../services/CampaignManagerApi';
import updateCampaignVersion from './updateCampaignVersion';
import TemplateVariablesEditor from '../database/contents/templates/TemplateVariablesEditor';

export default ({ campaignVersion, campaign, forceUpdate, setCampaign, defaultTemplateVariables, enterpriseId }) => {
  const [versionName, setVersionName] = useState(campaignVersion.name ? campaignVersion.name : '');
  const [subject, setSubject] = useState(campaignVersion.subject ? campaignVersion.subject : '');
  const [senderName, setSenderName] = useState(campaignVersion.sender_name ? campaignVersion.sender_name : '');
  const [frenchEspsSubject, setFrenchEspsSubject] = useState(campaignVersion.french_esps_subject ? campaignVersion.french_esps_subject : '');
  const [html, setHtml] = useState(campaignVersion.html ? campaignVersion.html : '');
  const [previewText, setPreviewText] = useState(campaignVersion.preview_text ? campaignVersion.preview_text : '');

  const [saving, setSaving] = useState(false);
  const [templateVariables, setTemplateVariables] = useState({});

  useEffect(() => {
    (() => {
      let nextTemplateVariables = { ...campaignVersion?.template_variables };

      if (defaultTemplateVariables) {
        defaultTemplateVariables.map((variable) => {
          if (nextTemplateVariables[variable] === undefined) {
            nextTemplateVariables[variable] = '';
          }
          return variable;
        });
      }
      setTemplateVariables(nextTemplateVariables);
    })();
  }, [defaultTemplateVariables, campaignVersion, setTemplateVariables]);

  useEffect(() => {
    (() => {
      if (campaignVersion && !campaignVersion.template_variables) {
        campaignVersion.template_variables = templateVariables;
      }
    })();
  }, [templateVariables, campaignVersion]);

  return (
    <>
      {campaign.versions.length > 1 && (
        <CRow>
          <CCol xl={12}>
            <CFormGroup>
              <CLabel htmlFor="versionName">Version name</CLabel>
              <CInput size="sm" type="text" id="versionName" placeholder="Version Name" required value={versionName} onChange={(event) => setVersionName(event.target.value)} />
            </CFormGroup>
          </CCol>
        </CRow>
      )}

      {
        <CRow>
          <CCol xl={12}>
            <CFormGroup>
              <CLabel htmlFor="subject">Subject</CLabel>
              <CInput size="sm" type="text" id="subject" placeholder="Subject" required value={subject} onChange={(event) => setSubject(event.target.value)} />
            </CFormGroup>
          </CCol>

          <CCol xl={12}>
            <CFormGroup>
              <CLabel htmlFor="subject">French Esps Subject</CLabel>
              <CInput size="sm" type="text" id="frenchEspsSubject" placeholder="Subject" required value={frenchEspsSubject} onChange={(event) => setFrenchEspsSubject(event.target.value)} />
            </CFormGroup>
          </CCol>

          <CCol xl={12}>
            <CFormGroup>
              <CLabel htmlFor="senderName">Sender name</CLabel>

              <CInput
                size="sm"
                type="text"
                id="senderName"
                placeholder="Sender Name"
                required
                value={senderName}
                data-form-type="other"
                data-lpignore="true"
                onChange={(event) => setSenderName(event.target.value)}
              />
              <small id="passwordHelpBlock" className="form-text text-muted">
                You can use the variable &#123;&#123;database.name&#125;&#125; it will be replaced by the name of your database.
              </small>
            </CFormGroup>
          </CCol>

          {defaultTemplateVariables && defaultTemplateVariables.length > 0 && (
            <CCol xl={12}>
              <CFormGroup>
                <TemplateVariablesEditor variables={templateVariables} setVariables={setTemplateVariables} used={false} html={' '} campaignMode={true} />
              </CFormGroup>
            </CCol>
          )}

          <CCol xl={12}>
            <CFormGroup>
              <CLabel htmlFor="previewText">Preview text</CLabel>
              <CInput size="sm" type="text" id="previewText" placeholder="Preview Text" value={previewText} onChange={(event) => setPreviewText(event.target.value)} />
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
                style={{ width: '100%' }}
              />
            </CFormGroup>
          </CCol>
        </CRow>
      }

      <CRow>
        <CCol xl={12}>
          <CButton
            className="mr-2"
            size="sm"
            color="primary"
            onClick={async () => {
              setSaving(true);
              let newCampaign = { ...campaign };
              let toUpdateCampaignVersion = {
                id: campaignVersion.id,
                name: versionName,
                subject: subject,
                french_esps_subject: frenchEspsSubject,
                sender_name: senderName,
                html: html,
                preview_text: previewText,
                template_variables: templateVariables
              };
              newCampaign.versions = [...newCampaign.versions].map((version) => (version.id === campaignVersion.id ? toUpdateCampaignVersion : version));
              await updateCampaignVersion(CampaignManagerApi, toUpdateCampaignVersion, 'Template has been saved', forceUpdate, enterpriseId);
              setCampaign(newCampaign);
              setSaving(false);
            }}
          >
            {saving && <CSpinner as="span" animation="grow" size="sm" role="status" aria-hidden="true" color="secondary" />}
            Save
          </CButton>
        </CCol>
      </CRow>
    </>
  );
};
