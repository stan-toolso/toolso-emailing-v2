import React from 'react';
import { CCard, CCardHeader, CCardBody, CSpinner } from '@coreui/react';

export default () => {
  return (
    <CCard className="bg-primary" style={{ width: '350px', margin: '160px auto' }}>
      <CCardHeader>Loading the app</CCardHeader>

      <CCardBody>
        <div style={{ textAlign: 'center', padding: '50px 0px' }}>
          <CSpinner animation="grow" color="secondary" />
        </div>
      </CCardBody>
    </CCard>
  );
};
