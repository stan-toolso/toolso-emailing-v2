import React from 'react';

import { CRow, CCol, CCard } from '@coreui/react';
import DelivStatsCard from '../sendings/deliv/DelivStatsCard';
import SendingConfigs from '../sendings/settings/SendingConfigs';
export default () => {
  return (
    <>
      <CRow>
        <CCol>
          <DelivStatsCard />
        </CCol>
      </CRow>
      <CRow>
        <CCol>
          <CCard>
            <SendingConfigs />
          </CCard>
        </CCol>
      </CRow>
    </>
  );
};
