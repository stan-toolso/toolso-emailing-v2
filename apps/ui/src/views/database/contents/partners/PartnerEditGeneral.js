import React, { useState } from 'react';
import { CCol, CRow, CButton, CFormGroup, CLabel, CInput, CSpinner, CTextarea } from '@coreui/react';

import { useMutation } from '@apollo/client';
import gql from 'graphql-tag';
import { toast } from 'react-toastify';

export default ({ partner, forceUpdate }) => {
  const [name, setName] = useState(partner.name);
  const [validatorsEmails, setValidatorsEmails] = useState(partner.validatorsEmails);
  const [defaultMessage, setDefaultMessage] = useState(partner.defaultMessage);

  const [updatePartner, { loading: updating }] = useMutation(gql`
    mutation updatePartner($partner: JSON!) {
      updatePartner(partner: $partner) {
        id
        name
        validatorsEmails
        defaultMessage
      }
    }
  `);

  return (
    <>
      <CRow>
        <CCol xl={12}>
          <CFormGroup>
            <CLabel htmlFor="name">Partner name</CLabel>
            <CInput size="sm" type="text" id="name" placeholder="Partner Name" required value={name} onChange={(event) => setName(event.target.value)} />
          </CFormGroup>
        </CCol>
      </CRow>
      <CRow>
        <CCol xl={12}>
          <CFormGroup>
            <CLabel htmlFor="validatorsEmails">Validators emails (comma separated)</CLabel>
            <CInput size="sm" type="text" id="validatorsEmails" placeholder="Validators emails" required value={validatorsEmails} onChange={(event) => setValidatorsEmails(event.target.value)} />
          </CFormGroup>
        </CCol>
      </CRow>
      <CRow>
        <CCol xl={12}>
          <CFormGroup>
            <CLabel htmlFor="defaultMessage">Default bat message</CLabel>

            <CTextarea size="sm" id="message" placeholder="Default bat message" style={{ height: '100px' }} value={defaultMessage} onChange={(event) => setDefaultMessage(event.target.value)} />
          </CFormGroup>
        </CCol>
      </CRow>
      <CRow>
        <CCol xl={12}>
          <CButton
            color="info"
            size="sm"
            onClick={async () => {
              let result = await updatePartner({
                variables: {
                  partner: {
                    id: partner.id,
                    name,
                    defaultMessage,
                    validatorsEmails
                  }
                }
              });
              if (result && result.data && result.data.updatePartner) {
                toast.success(`Partner ${name} has been updated`, {
                  position: toast.POSITION.BOTTOM_RIGHT
                });
                forceUpdate();
              } else {
                toast.error('Failed to update partner', {
                  position: toast.POSITION.BOTTOM_RIGHT
                });
              }
            }}
          >
            {updating && <CSpinner as="span" animation="grow" size="sm" role="status" aria-hidden="true" color="secondary" />}
            Update
          </CButton>
        </CCol>
      </CRow>
    </>
  );
};
