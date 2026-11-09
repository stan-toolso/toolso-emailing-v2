import React from 'react';

import { CCard, CCardBody, CCardHeader, CCol, CRow } from '@coreui/react';
import InscriptionList from './InscriptionList';

export default () => {
  return (
    <CRow>
      <CCol xl={12}>
        <CCard>
          <CCardHeader>Inscriptions</CCardHeader>
          <CCardBody>
            <InscriptionList />
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  );
};
