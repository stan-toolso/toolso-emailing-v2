import React from 'react';
import { CCol, CRow } from '@coreui/react';

import ByEspOrSubSourceInscriptionStatsCard from './ByEspOrSubSourceInscriptionStatsCard';

export default () => {
  return (
    <>
      <CRow>
        <CCol>
          <ByEspOrSubSourceInscriptionStatsCard />
        </CCol>
      </CRow>
    </>
  );
};
