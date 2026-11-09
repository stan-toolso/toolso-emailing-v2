import React from 'react';
import DelivStatsCard from './DelivStatsCard';

import { CRow, CCol } from '@coreui/react';

export default () => {
  return (
    <>
      <CRow>
        <CCol sm="12" lg="12">
          <DelivStatsCard />
        </CCol>
      </CRow>
    </>
  );
};
