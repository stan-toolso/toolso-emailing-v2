import React, { useEffect, useState } from 'react';
import { CButton, CCol, CModal, CModalBody, CModalFooter, CModalHeader, CRow, CSpinner, CLabel, CFormGroup } from '@coreui/react';
import { gql, useMutation } from '@apollo/client';
import AceEditor from 'react-ace';
import 'brace/ext/language_tools';
import 'ace-builds/src-noconflict/mode-html';
import 'ace-builds/src-noconflict/theme-github';
import TemplatePartsSelector from '../templateParts/TemplatePartsSelector';

export default ({ html, setHtml, show, toggle }) => {
  const [bottomCode, setBottomCode] = useState(sessionStorage.getItem('INSERT_CODE_MODAL_BOTTOM') ? sessionStorage.getItem('INSERT_CODE_MODAL_BOTTOM') : '');
  const [topCode, setTopCode] = useState(sessionStorage.getItem('INSERT_CODE_MODAL_TOP') ? sessionStorage.getItem('INSERT_CODE_MODAL_TOP') : '');

  const [topPartId, setTopPartId] = useState(null);
  const [bottomPartId, setBottomPartId] = useState(null);

  useEffect(() => {
    sessionStorage.setItem('INSERT_CODE_MODAL_BOTTOM', bottomCode);
    sessionStorage.setItem('INSERT_CODE_MODAL_TOP', topCode);
  }, [bottomCode, topCode]);

  const [insertCode, { loading }] = useMutation(gql`
    mutation InsertCodeInHtml($html: String!, $code: String!, $position: String!) {
      insertCodeInHtml(html: $html, code: $code, position: $position)
    }
  `);

  return (
    <CModal show={show} color="info" onClose={toggle} size="lg">
      <CModalHeader>Code insertion</CModalHeader>
      <CModalBody>
        <CRow>
          <CCol xl={6}>
            <CFormGroup>
              <CLabel htmlFor="htmlTemplate">Insert to the Top</CLabel>
              <TemplatePartsSelector
                contentTemplatePartId={topPartId}
                setContentTemplatePartId={setTopPartId}
                setContentTemplatePart={(part) => {
                  if (part) {
                    setTopCode(`{{{template_part.${part.uid}}}}`);
                  }
                }}
                nullLabel="Custom Code"
              />
              <AceEditor
                placeholder="Code to Insert"
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
                readOnly={topPartId !== null}
                onChange={setTopCode}
                fontSize={13}
                showPrintMargin={false}
                showGutter={true}
                highlightActiveLine={true}
                value={topCode}
                style={{ width: '100%', height: '200px' }}
              />
            </CFormGroup>
          </CCol>
          <CCol xl={6}>
            <CFormGroup>
              <CLabel htmlFor="htmlTemplate">Insert to the Bottom</CLabel>
              <TemplatePartsSelector
                contentTemplatePartId={bottomPartId}
                setContentTemplatePartId={setBottomPartId}
                setContentTemplatePart={(part) => {
                  if (part) {
                    setBottomCode(`{{{template_part.${part.uid}}}}`);
                  }
                }}
                nullLabel="Custom Code"
              />
              <AceEditor
                placeholder="Code to Insert"
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
                readOnly={bottomPartId !== null}
                onChange={setBottomCode}
                fontSize={13}
                showPrintMargin={false}
                showGutter={true}
                highlightActiveLine={true}
                value={bottomCode}
                style={{ width: '100%', height: '200px' }}
              />
            </CFormGroup>
          </CCol>
        </CRow>
      </CModalBody>
      <CModalFooter>
        <CButton onClick={toggle}>Cancel</CButton>
        <CButton
          color="info"
          onClick={async () => {
            let result = await insertCode({
              variables: {
                html,
                code: topCode,
                position: 'top'
              }
            });
            let newHtml = result.data.insertCodeInHtml;
            result = await insertCode({
              variables: {
                html: newHtml,
                code: bottomCode,
                position: 'bottom'
              }
            });
            setHtml(result.data.insertCodeInHtml);
            toggle();
          }}
        >
          {loading && <CSpinner color="secondary" />}
          Insert code
        </CButton>
      </CModalFooter>
    </CModal>
  );
};
