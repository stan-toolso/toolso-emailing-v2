import React, { useState, useContext } from 'react';
import { CButton, CFormGroup, CInput, CLabel, CModal, CModalBody, CModalFooter, CModalHeader, CSpinner } from '@coreui/react';
import { gql } from '@apollo/client';
import { toast } from 'react-toastify';

import EmailingDatabaseApiContext from '../../../contexts/EmailingDatabaseApiContext';

export default (props) => {
  const show = props.show;
  const toggle = props.toggle;

  const [name, setName] = useState('');
  const [keyCreated, setKeyCreated] = useState('');
  const [copySuccess, setCopySuccess] = useState('');

  const [loading, setLoading] = useState(false);
  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);

  const createApiKey = async () => {
    setLoading(true);
    try {
      let query = {
        mutation: gql`
          mutation CreateApiKey($name: String!) {
            createApiKey(name: $name) {
              apiKey
            }
          }
        `,
        variables: { name }
      };
      let result = await emailingDatabaseApiContext.doMutation(query);
      if (result && result.data && result.data) {
        setKeyCreated(result.data.createApiKey.apiKey);
      }
    } catch (err) {
      console.log(err);
      toast.error('Api Key cannot be created', {
        position: toast.POSITION.BOTTOM_RIGHT
      });
    }
    setLoading(false);
  };

  function copyToClipboard(e) {
    navigator.clipboard.writeText(keyCreated);
    e.target.focus();
    setCopySuccess('Copied!');
  }

  return (
    <CModal show={show} color="info" onClose={toggle}>
      <CModalHeader>{'New Api Key creation'}</CModalHeader>
      <CModalBody>
        {!keyCreated && (
          <CFormGroup>
            <CLabel htmlFor="name">Choose your key name</CLabel>
            <CInput
              type="text"
              id="name"
              placeholder="Key name"
              required
              value={name}
              onChange={(event) => {
                setName(event.target.value);
              }}
            />
          </CFormGroup>
        )}
        {keyCreated && (
          <>
            <CFormGroup>
              <CLabel htmlFor="name">Please Copy your api Key</CLabel>
              <span className="d-flex flex-row">
                <CInput type="text" id="apiKey" placeholder="Api Key" readonly="true" value={keyCreated} onClick={copyToClipboard}></CInput>
                <i className="fas fa-clipboard" style={{ cursor: 'pointer', marginLeft: '15px', marginTop: '10px' }} onClick={copyToClipboard}></i>
              </span>
            </CFormGroup>
            {copySuccess}
          </>
        )}
      </CModalBody>
      <CModalFooter>
        <CButton onClick={toggle}>Cancel</CButton>
        {!keyCreated && (
          <CButton color="info" onClick={createApiKey}>
            {loading && <CSpinner color="secondary" />}
            {'Generate Key'}
          </CButton>
        )}
        {keyCreated && (
          <CButton
            color="info"
            onClick={() => {
              setKeyCreated('');
              setCopySuccess('');
              toggle();
            }}
          >
            {'Close'}
          </CButton>
        )}
      </CModalFooter>
    </CModal>
  );
};
