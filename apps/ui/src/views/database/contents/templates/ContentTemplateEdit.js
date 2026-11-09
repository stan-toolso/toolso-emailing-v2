import React, { useState, useEffect } from 'react';
import { CCard, CCardBody, CCardHeader, CCol, CRow, CButton, CFormGroup, CLabel, CInput, CCardFooter, CSpinner } from '@coreui/react';

import AceEditor from 'react-ace';
import 'brace/ext/language_tools';
import 'ace-builds/src-noconflict/mode-html';
import 'ace-builds/src-noconflict/theme-github';
import { useQuery, useMutation } from '@apollo/client';
import gql from 'graphql-tag';
import { toast } from 'react-toastify';
import { useSettings } from '../../../common/Settings';

const TEMPLATE = gql`
  query contentTemplate($id: ID!) {
    contentTemplate(id: $id) {
      id
      name
      html
      subject
      previewText
      frenchEspsSubject
      senderName
      createdAt
      updatedAt
      html
    }
  }
`;

export default ({ match }) => {
  const contentTemplateId = match.params.content_template_id;

  const [name, setName] = useState('');
  const [senderName, setSenderName] = useState('');
  const [subject, setSubject] = useState('');
  const [frenchEspsSubject, setFrenchEspsSubject] = useState('');

  const [html, setHtml] = useState('');
  const [previewText, setPreviewText] = useState('');
  const [canEditSenderName] = useSettings('canEditSenderName');

  const { loading, data } = useQuery(TEMPLATE, {
    variables: {
      id: contentTemplateId
    }
  });
  useEffect(() => {
    if (data) {
      setName(data.contentTemplate.name);
      setSenderName(data.contentTemplate.senderName);
      setSubject(data.contentTemplate.subject);
      setFrenchEspsSubject(data.contentTemplate.frenchEspsSubject);
      setHtml(data.contentTemplate.html);
      setPreviewText(data.contentTemplate.previewText ? data.contentTemplate.previewText : '');
    }
  }, [data, setSubject, setHtml, setPreviewText, setSenderName, setFrenchEspsSubject]);

  const [updateContentTemplate, { loading: updating, data: updatedData }] = useMutation(gql`
    mutation UpdateContentTemplate($contentTemplate: JSON!) {
      updateContentTemplate(contentTemplate: $contentTemplate) {
        id
        name
        html
        previewText
        frenchEspsSubject
        senderName
        subject
        createdAt
        updatedAt
        html
      }
    }
  `);

  useEffect(() => {
    if (!updating && updatedData) {
      toast.success('Template is updated', {
        position: toast.POSITION.BOTTOM_RIGHT
      });
    }
  }, [updating, updatedData]);

  if (loading) {
    return (
      <div className="pt-3 text-center">
        <div className="sk-spinner sk-spinner-pulse"></div>
      </div>
    );
  }
  return (
    <>
      <CCard>
        <CCardHeader>
          #{contentTemplateId} : {name}
        </CCardHeader>
        <CCardBody>
          <CRow>
            <CCol xl={12}>
              <CFormGroup>
                <CLabel htmlFor="name">Template name</CLabel>
                <CInput size="sm" type="text" id="name" placeholder="Template Name" required value={name} onChange={(event) => setName(event.target.value)} />
              </CFormGroup>
            </CCol>
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
                  <CLabel htmlFor="subject">French Esps Subject</CLabel>
                  <CInput
                    size="sm"
                    type="text"
                    id="frenchEspsSubject"
                    placeholder="French Esps Subject"
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
        </CCardBody>
        <CCardFooter>
          <CButton
            color="info"
            size="sm"
            onClick={() => {
              updateContentTemplate({
                variables: {
                  contentTemplate: {
                    ...data.contentTemplate,
                    name,
                    html,
                    subject,
                    senderName,
                    previewText,
                    frenchEspsSubject
                  }
                }
              });
            }}
          >
            {updating && <CSpinner as="span" animation="grow" size="sm" role="status" aria-hidden="true" color="secondary" />}
            Update
          </CButton>
        </CCardFooter>
      </CCard>
    </>
  );
};
