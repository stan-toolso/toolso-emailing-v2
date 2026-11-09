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

  const [createPartner, { loading, data }] = useMutation(gql`
    mutation CreatePartner($name: String!) {
      createPartner(name: $name) {
        id
        name
      }
    }
  `);

  useEffect(() => {
    if (data) {
      let partnerId = data.createPartner.id;
      history.push(`/${emailingDatabaseApiContext.getUid()}/contents/partners/${partnerId}`);
      toggle();
    }
  }, [data, history, emailingDatabaseApiContext, toggle]);
  return (
    <CModal show={show} color="info">
      <CModalHeader>New partner creation</CModalHeader>
      <CModalBody>
        <CRow>
          <CCol>
            <CFormGroup>
              <CLabel htmlFor="name">Choose your partner name</CLabel>
              <CInput
                size="sm"
                type="text"
                id="name"
                placeholder="Partner name"
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
            createPartner({ variables: { name } });
          }}
        >
          {loading && <CSpinner color="secondary" />}
          Create
        </CButton>
      </CModalFooter>
    </CModal>
  );
};
