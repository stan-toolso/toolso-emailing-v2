import React, { useCallback, useState } from 'react';
import Select from 'react-select';
import { useSelector } from 'react-redux';

import { CButton, CCol, CFormGroup, CLabel, CModal, CModalBody, CModalFooter, CModalHeader, CRow, CSpinner } from '@coreui/react';
import { toast } from 'react-toastify';
import { gql, useMutation } from '@apollo/client';

const options = [
  { value: 'email', label: 'Email' },
  { value: 'md5', label: 'MD5' },
  { value: 'sha1', label: 'SHA1' },
  { value: 'sha256', label: 'SHA256' },
  { value: 'firstname', label: 'Firstname' },
  { value: 'lastname', label: 'Lastname' },
  { value: 'gender', label: 'Gender' },
  { value: 'street', label: 'Street' },
  { value: 'zipcode', label: 'Zipcode' },
  { value: 'city', label: 'City' },
  { value: 'dob', label: 'Day of Birth' },
  { value: 'phone', label: 'Phone' },
  { value: 'esp', label: 'ESP' },
  { value: 'status', label: 'Status' },
  { value: 'createdAt', label: 'Insertion Date' },
  { value: 'ip', label: 'IP' },
  { value: 'collectUrl', label: 'Collect Url' }
];

export default ({ show, toggle, filter }) => {
  const enterprise = useSelector((state) => state.entreprise);
  const [fields, setFields] = useState(['email']);

  const [exportContacts, { loading }] = useMutation(gql`
    mutation exportContacts($fields: [String]!, $format: String, $filter: JSON, $enterpriseId: ID) {
      exportContacts(format: $format, fields: $fields, filter: $filter, enterpriseId: $enterpriseId)
    }
  `);

  const onFieldsChanged = useCallback(
    (values) => {
      let fields = [];
      if (values) {
        for (let value of values) {
          fields.push(value.value);
        }
      }
      setFields(fields);
    },
    [setFields]
  );

  return (
    <CModal show={show} color="info" onClose={toggle}>
      <CModalHeader>Contact Export</CModalHeader>
      <CModalBody>
        <CRow>
          <CCol>
            <CFormGroup>
              <CLabel htmlFor="emails">Select the fields to export:</CLabel>
              <Select
                value={options.filter((option) => {
                  return fields && fields.indexOf(option.value) >= 0;
                })}
                onChange={onFieldsChanged}
                isMulti={true}
                options={options}
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
            let result = await exportContacts({
              variables: {
                fields,
                format: null,
                filter,
                enterpriseId: enterprise.id
              }
            });
            if (result && result.data) {
              toast.success(`Export is started. You will receive the download link by email.`, {
                position: toast.POSITION.BOTTOM_RIGHT
              });
            } else {
              toast.error('Failed to start export.', {
                position: toast.POSITION.BOTTOM_RIGHT
              });
            }
          }}
        >
          {loading && <CSpinner color="secondary" />}
          Export contacts
        </CButton>
      </CModalFooter>
    </CModal>
  );
};
