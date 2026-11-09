import React, { useState, useEffect } from 'react';
import { CButton, CCol, CFormGroup, CInput, CLabel, CModal, CModalBody, CModalFooter, CModalHeader, CRow } from '@coreui/react';
import { toast } from 'react-toastify';
import { gql, useMutation } from '@apollo/client';
import { getClient } from '../../services/AccessManager/AccessManager';

export default (props) => {
  const show = props.show;
  const toggle = props.toggle;
  const initialEmail = props.email;

  const [email, setEmail] = useState(initialEmail);

  useEffect(() => {
    if (props.email) {
      setEmail(props.email);
    }
  }, [props.email, setEmail]);

  const [requestNewResetLink] = useMutation(
    gql`
      mutation RequestNewResetLink($email: String!) {
        requestNewResetLink(email: $email)
      }
    `,
    {
      client: getClient()
    }
  );

  return (
    <CModal show={show} color="info" onClose={toggle}>
      <CModalHeader>Forgot Password</CModalHeader>
      <CModalBody>
        <CRow>
          <CCol lg="8">
            <CFormGroup>
              <CLabel htmlFor="name">Please Enter your email adress :</CLabel>
              <CInput
                type="text"
                id="name"
                placeholder="E-Mail"
                required
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                }}
              ></CInput>
            </CFormGroup>
          </CCol>
        </CRow>
      </CModalBody>
      <CModalFooter>
        <CButton
          color="info"
          onClick={() => {
            requestNewResetLink({
              variables: {
                email
              }
            });
            toast.success(`if your account exist, an email will be sent to your adress ${email} in order to reset your password`, {
              position: toast.POSITION.BOTTOM_RIGHT,
              autoClose: 10000
            });
            toggle();
          }}
        >
          Send Password reset email
        </CButton>
      </CModalFooter>
    </CModal>
  );
};
