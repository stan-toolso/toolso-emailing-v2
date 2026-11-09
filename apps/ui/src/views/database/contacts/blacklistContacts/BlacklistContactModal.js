import React, { useState } from 'react';
import { CButton, CCol, CFormGroup, CInput, CLabel, CModal, CModalBody, CModalFooter, CModalHeader, CRow, CSpinner } from '@coreui/react';

import { toast } from 'react-toastify';

import { gql, useMutation } from '@apollo/client';

import { useSelector } from 'react-redux';

export default ({ defaultEmail, defaultMd5, defaultSha1, defaultSha256, show, toggle }) => {
  const [email, setEmail] = useState(defaultEmail ? defaultEmail : '');
  const [md5, setMd5] = useState(defaultMd5 ? defaultMd5 : '');
  const [sha1, setSha1] = useState(defaultSha1 ? defaultSha1 : '');
  const [sha256, setSha256] = useState(defaultSha256 ? defaultSha256 : '');
  const user = useSelector((state) => state.user);

  const [blacklistContactWithFields, { loading }] = useMutation(gql`
    mutation blacklistContactWithFields($email: String, $sha1: String, $sha256: String, $md5: String, $origin: String!, $reason: String!) {
      blacklistContactWithFields(email: $email, sha1: $sha1, sha256: $sha256, md5: $md5, origin: $origin, reason: $reason) {
        id
      }
    }
  `);

  return (
    <CModal show={show} color="info" onClose={toggle}>
      <CModalHeader>Blacklist Contact</CModalHeader>
      <CModalBody>
        <CRow>
          <CCol xl={12}>
            <CFormGroup>
              <CLabel htmlFor="emails">Email</CLabel>
              <CInput size="sm" type="text" id="emails" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </CFormGroup>
          </CCol>
        </CRow>
        <CRow>
          <CCol xl={12}>
            <CFormGroup>
              <CLabel htmlFor="md5">Md5</CLabel>
              <CInput size="sm" type="text" id="md5" disabled={email !== ''} placeholder="Md5" value={md5} onChange={(event) => setMd5(event.target.value)} />
            </CFormGroup>
          </CCol>
        </CRow>
        <CRow>
          <CCol xl={12}>
            <CFormGroup>
              <CLabel htmlFor="sha1">Sha1</CLabel>
              <CInput size="sm" type="text" id="sha1" disabled={email !== ''} placeholder="Sha1" required value={sha1} onChange={(event) => setSha1(event.target.value)} />
            </CFormGroup>
          </CCol>
        </CRow>
        <CRow>
          <CCol xl={12}>
            <CFormGroup>
              <CLabel htmlFor="sha256">Sha256</CLabel>
              <CInput size="sm" type="text" id="sha256" disabled={email !== ''} placeholder="Sha256" required value={sha256} onChange={(event) => setSha256(event.target.value)} />
            </CFormGroup>
          </CCol>
        </CRow>
      </CModalBody>
      <CModalFooter>
        <CButton onClick={toggle}>Cancel</CButton>
        <CButton
          color="info"
          onClick={async () => {
            await blacklistContactWithFields({
              variables: {
                email,
                md5: email ? null : md5,
                sha1: sha1 ? null : sha1,
                sha256: sha256 ? null : sha256,
                origin: `Toolso Emailing Website - Contact detail - Blacklisted by ${user.email}`,
                reason: ''
              }
            });

            toast.success(`Contact blacklisted `, {
              position: toast.POSITION.BOTTOM_RIGHT
            });
            toggle();
          }}
        >
          {loading && <CSpinner color="secondary" />}
          Blacklist
        </CButton>
      </CModalFooter>
    </CModal>
  );
};
