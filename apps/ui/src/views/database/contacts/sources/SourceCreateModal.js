import React, { useState, useEffect, useContext } from 'react';
import { useHistory } from 'react-router-dom';
import { CButton, CCol, CFormGroup, CInput, CLabel, CModal, CModalBody, CModalFooter, CModalHeader, CRow, CSpinner } from '@coreui/react';
import { gql, useMutation } from '@apollo/client';

import EmailingDatabaseApiContext from '../../../../contexts/EmailingDatabaseApiContext';

export default (props) => {
  const show = props.show;
  const toggle = props.toggle;
  const parentSource = props.parentSource;

  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);
  const [name, setName] = useState('');
  const history = useHistory();

  const [createContactSource, { loading, data }] = useMutation(gql`
    mutation CreateContactSource($name: String!, $parentSourceId: ID) {
      createContactSource(name: $name, parentSourceId: $parentSourceId) {
        id
        name
      }
    }
  `);

  useEffect(() => {
    if (data) {
      if (!parentSource) {
        let sourceId = data.createContactSource.id;
        history.push(`/${emailingDatabaseApiContext.getUid()}/contacts/inscriptions/sources/edit/${sourceId}`);
      }
      toggle();
    }
  }, [data, history, emailingDatabaseApiContext, toggle, parentSource]);
  return (
    <CModal show={show} color="info">
      <CModalHeader>{parentSource ? 'Child Source Creation' : 'New source creation'}</CModalHeader>
      <CModalBody>
        <CRow>
          <CCol>
            <CFormGroup>
              <CLabel htmlFor="name">Choose your source name</CLabel>
              <CInput
                size="sm"
                type="text"
                id="name"
                placeholder="Source name"
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
            createContactSource({ variables: { name, parentSourceId: parentSource ? parseInt(parentSource.id) : undefined } });
          }}
        >
          {loading && <CSpinner color="secondary" />}
          Create
        </CButton>
      </CModalFooter>
    </CModal>
  );
};
