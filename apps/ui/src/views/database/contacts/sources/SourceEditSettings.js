import React, { useEffect, useState } from 'react';
import { CButton, CCol, CFormGroup, CInput, CLabel, CSpinner } from '@coreui/react';
import { gql, useMutation } from '@apollo/client';

import ChildConfigEdit from './ChildConfigEdit';

export default ({ source, refetch }) => {
  const [name, setName] = useState(source.name);
  const [utmSource, setUtmSource] = useState(source.utmSource);

  const [updateContactSource, { loading: saving, data: dataSaved }] = useMutation(
    gql`
      mutation updateContactSource($source: JSON!) {
        updateContactSource(source: $source) {
          id
          name
          utmSource
        }
      }
    `
  );

  useEffect(() => {
    if (dataSaved) {
      setName(dataSaved.updateContactSource.name);
      setUtmSource(dataSaved.updateContactSource.utmSource);
    }
  }, [dataSaved, setName, setUtmSource]);

  return (
    <>
      <CCol xl={12}>
        <CFormGroup row>
          <CCol md="2">
            <CLabel htmlFor="name">Name</CLabel>
          </CCol>
          <CCol md="10">
            <CInput
              size="sm"
              name="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
              }}
            />
          </CCol>
        </CFormGroup>
      </CCol>

      <CCol xl={12}>
        <CFormGroup row>
          <CCol md="2">
            <CLabel htmlFor="name">Utm Source</CLabel>
          </CCol>
          <CCol md="10">
            <CInput
              size="sm"
              name="utmSource"
              value={utmSource}
              onChange={(e) => {
                setUtmSource(e.target.value);
              }}
            />
          </CCol>
        </CFormGroup>
      </CCol>

      {source?.parentSource && source?.parentSource?.defaultChildSource?.id !== source?.id && <ChildConfigEdit forceUpdate={refetch} source={source} updateContactSource={updateContactSource} />}

      <CCol xl={12}>
        <CButton
          size="sm"
          color="primary"
          onClick={async () => {
            await updateContactSource({
              variables: {
                source: {
                  id: source.id,
                  name,
                  utmSource
                }
              }
            });
            refetch();
          }}
        >
          {saving && <CSpinner as="span" animation="grow" size="sm" role="status" aria-hidden="true" color="secondary" />}
          Save
        </CButton>
      </CCol>
    </>
  );
};
