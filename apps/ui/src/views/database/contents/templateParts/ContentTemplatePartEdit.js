import React, { useState, useEffect } from 'react';
import { CCard, CCardBody, CCardHeader, CCol, CRow, CButton, CFormGroup, CLabel, CInput, CCardFooter, CSpinner } from '@coreui/react';

import AceEditor from 'react-ace';
import 'brace/ext/language_tools';
import 'ace-builds/src-noconflict/mode-html';
import 'ace-builds/src-noconflict/theme-github';
import { useQuery, useMutation } from '@apollo/client';
import gql from 'graphql-tag';
import { toast } from 'react-toastify';

const TEMPLATE_PART = gql`
  query contentTemplatePart($id: ID!) {
    contentTemplatePart(id: $id) {
      id
      name
      uid
      html
      createdAt
      updatedAt
    }
  }
`;

export default ({ match }) => {
  const contentTemplatePartId = match.params.content_template_part_id;

  const [name, setName] = useState('');
  const [uid, setUid] = useState('');

  const [html, setHtml] = useState('');

  const { loading, data } = useQuery(TEMPLATE_PART, {
    variables: {
      id: contentTemplatePartId
    }
  });
  useEffect(() => {
    if (data) {
      setName(data.contentTemplatePart.name);
      setUid(data.contentTemplatePart.uid);
      setHtml(data.contentTemplatePart.html);
    }
  }, [data, setName, setUid, setHtml]);

  const [updateContentTemplatePart, { loading: updating, data: updatedData }] = useMutation(gql`
    mutation UpdateContentTemplatePart($contentTemplatePart: JSON!) {
      updateContentTemplatePart(contentTemplatePart: $contentTemplatePart) {
        id
        name
        uid
        html
      }
    }
  `);

  useEffect(() => {
    if (!updating && updatedData) {
      toast.success('Template part is updated', {
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
          #{contentTemplatePartId} : {name}
        </CCardHeader>
        <CCardBody>
          <CRow>
            <CCol xl={12}>
              <CFormGroup>
                <CLabel htmlFor="name">Template part name</CLabel>
                <CInput size="sm" type="text" id="name" placeholder="Template Part Name" required value={name} onChange={(event) => setName(event.target.value)} />
              </CFormGroup>
            </CCol>
            <CCol xl={12}>
              <CFormGroup>
                <CLabel htmlFor="uid">UID</CLabel>
                <CInput size="sm" type="text" id="uid" placeholder="UID" required value={uid} onChange={(event) => setUid(event.target.value)} />
                <small>This template part can be used with shortcode: {`{{{template_part.${uid}}}}`}</small>
              </CFormGroup>
            </CCol>

            <CCol xl={12}>
              <CFormGroup>
                <CLabel htmlFor="htmlTemplate">Template Part HTML</CLabel>

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
              updateContentTemplatePart({
                variables: {
                  contentTemplatePart: {
                    ...data.contentTemplatePart,
                    name,
                    html,
                    uid
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
