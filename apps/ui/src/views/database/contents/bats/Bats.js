import { CCard, CCardBody, CCardHeader, CCol, CRow } from '@coreui/react';
import React from 'react';

import BatsTable from './BatsTable';

export default ({ partnerId }) => {
  return (
    <>
      <CRow>
        <CCol xl={12}>
          {partnerId && (
            <CCardBody>
              <BatsTable partnerId={partnerId} />
            </CCardBody>
          )}
          {!partnerId && (
            <>
              <CCard>
                <CCardHeader>BATs</CCardHeader>
                <CCardBody>
                  <BatsTable partnerId={partnerId} />
                </CCardBody>
              </CCard>
            </>
          )}
        </CCol>
      </CRow>
    </>
  );
};
