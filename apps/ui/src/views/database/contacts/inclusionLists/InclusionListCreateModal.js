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

  const [createInclusionList, { loading, data }] = useMutation(gql`
    mutation CreateInclusionList($name: String!) {
      createInclusionList(name: $name) {
        id
        name
      }
    }
  `);

  useEffect(() => {
    if (data) {
      let inclusionListId = data.createInclusionList.id;
      history.push(`/${emailingDatabaseApiContext.getUid()}/contacts/inclusionLists/${inclusionListId}`);
      toggle();
    }
  }, [data, history, emailingDatabaseApiContext, toggle]);
  return (
    <CModal show={show} color="info">
      <CModalHeader>New inclusion list creation</CModalHeader>
      <CModalBody>
        <CRow>
          <CCol>
            <CFormGroup>
              <CLabel htmlFor="name">Choose your inclusion list name</CLabel>
              <CInput
                size="sm"
                type="text"
                id="name"
                placeholder="Inclusion list name"
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
            createInclusionList({ variables: { name } });
          }}
        >
          {loading && <CSpinner color="secondary" />}
          Create
        </CButton>
      </CModalFooter>
    </CModal>
  );
};
