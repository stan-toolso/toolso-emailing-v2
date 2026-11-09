import React from 'react';

import { CRow, CCol } from '@coreui/react';
import Esps from '../contacts/inscriptions/Esps';
import ActivationStats from '../contacts/activation/ActivationStats';
import ActivationConfigs from '../contacts/activation/ActivationConfigs';
export default () => {
  return (
    <>
      <CRow>
        <CCol>
          <Esps />
        </CCol>
      </CRow>
      <CRow>
        <CCol>
          <ActivationStats />
        </CCol>
      </CRow>
      <CRow>
        <CCol>
          <ActivationConfigs />
        </CCol>
      </CRow>
    </>
  );
};
