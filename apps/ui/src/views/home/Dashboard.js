import { CCol, CRow } from '@coreui/react';
import React from 'react';
import HomeActivityStatsTable from './HomeActivityStatsTable';
import HomeGlobalStatsTable from './HomeGlobalStatsTable';
import HomeSendingStatsTable from './HomeSendingStatsTable';
import HomeWidgets from './HomeWidgets';
export default () => {
  return (
    <>
      <HomeWidgets />
      <CRow>
        <CCol>
          <HomeActivityStatsTable />
          <HomeGlobalStatsTable />
          <HomeSendingStatsTable />
        </CCol>
      </CRow>
    </>
  );
};
