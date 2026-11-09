import React, { useState, useEffect, useContext } from 'react';
import { useHistory } from 'react-router-dom';
import { CButton, CCol, CFormGroup, CInput, CLabel, CModal, CModalBody, CModalFooter, CModalHeader, CRow, CSpinner } from '@coreui/react';
import { gql, useMutation } from '@apollo/client';

import EmailingDatabaseApiContext from '../../../../contexts/EmailingDatabaseApiContext';

export default (props) => {
  const show = props.show;
  const toggle = props.toggle;
  const templateToClone = props.templateToClone;
  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);
  const [name, setName] = useState('');
  const history = useHistory();

  let createQuery = gql`
    mutation CreateContentTemplate($name: String!) {
      createContentTemplate(name: $name) {
        id
        name
      }
    }
  `;

  let duplicateQuery = gql`
    mutation DuplicateContentTemplate($name: String!, $duplicateContentTemplateId: ID!) {
      duplicateContentTemplate(name: $name, contentTemplateId: $duplicateContentTemplateId) {
        id
        name
      }
    }
  `;

  let variables = templateToClone ? { name: name, duplicateContentTemplateId: templateToClone?.id } : { name: name };

  const [createTemplate, { loading, data }] = useMutation(templateToClone ? duplicateQuery : createQuery);

  useEffect(() => {
    if (templateToClone && !name) {
      setName(`copy of ${templateToClone.name}`);
    }
  }, [templateToClone, setName, name]);

  useEffect(() => {
    if (data) {
      let templateId = templateToClone ? data.duplicateContentTemplate.id : data.createContentTemplate.id;
      history.push(`/${emailingDatabaseApiContext.getUid()}/contents/templates/${templateId}`);
      toggle();
    }
  }, [data, history, emailingDatabaseApiContext, toggle, templateToClone]);
  return (
    <CModal show={show} color="info">
      <CModalHeader>{templateToClone ? 'Template duplication' : 'New template creation'}</CModalHeader>
      <CModalBody>
        <CRow>
          <CCol>
            <CFormGroup>
              <CLabel htmlFor="name">Choose your template name</CLabel>
              <CInput
                size="sm"
                type="text"
                id="name"
                placeholder="Template name"
                required
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                }}
              ></CInput>
            </CFormGroup>
          </CCol>
        </CRow>
      </CModalBody>
      <CModalFooter>
        <CButton onClick={toggle}>Cancel</CButton>
        <CButton
          color="info"
          size="sm"
          onClick={() => {
            createTemplate({ variables: variables });
          }}
        >
          {loading && <CSpinner color="secondary" />}
          Create
        </CButton>
      </CModalFooter>
    </CModal>
  );
};
