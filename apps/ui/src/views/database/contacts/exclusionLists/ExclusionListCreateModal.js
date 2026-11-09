import React, { useState, useEffect, useContext } from 'react';
import { useHistory } from 'react-router-dom';
import { CButton, CCol, CFormGroup, CInput, CLabel, CModal, CModalBody, CModalFooter, CModalHeader, CRow, CSpinner } from '@coreui/react';
import { gql, useMutation } from '@apollo/client';

import EmailingDatabaseApiContext from '../../../../contexts/EmailingDatabaseApiContext';

export default (props) => {
  const show = props.show;
  const toggle = props.toggle;

  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);
  const [name, setName] = useState('');
  const history = useHistory();

  const [createExclusionList, { loading, data }] = useMutation(gql`
    mutation CreateExclusionList($name: String!) {
      createExclusionList(name: $name) {
        id
        name
      }
    }
  `);

  useEffect(() => {
    if (data) {
      let exclusionListId = data.createExclusionList.id;
      history.push(`/${emailingDatabaseApiContext.getUid()}/contacts/exclusionLists/${exclusionListId}`);
      toggle();
    }
  }, [data, history, emailingDatabaseApiContext, toggle]);
  return (
    <CModal show={show} color="info">
      <CModalHeader>New exclusion list creation</CModalHeader>
      <CModalBody>
        <CRow>
          <CCol>
            <CFormGroup>
              <CLabel htmlFor="name">Choose your exclusion list name</CLabel>
              <CInput
                size="sm"
                type="text"
                id="name"
                placeholder="Exclusion list name"
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
            createExclusionList({ variables: { name } });
          }}
        >
          {loading && <CSpinner color="secondary" />}
          Create
        </CButton>
      </CModalFooter>
    </CModal>
  );
};
