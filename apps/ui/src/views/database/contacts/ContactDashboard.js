import React from 'react';

import { CRow, CCol } from '@coreui/react';
import WorkableContactWidget from '../widgets/WorkableContactWidget';
import TotalContactWidget from '../widgets/TotalContactWidget';
import AvgContactsScoreWidget from '../widgets/AvgContactsScoreWidget';
import EspPieChartWidget from './widgets/EspPieChartWidget';
import StatusPieChartWidget from './widgets/StatusPieChartWidget';
import ScoreRepartitionWidget from './widgets/ScoreRepartitionWidget';
import GenderPieChartWidget from './widgets/GenderPieChartWidget';
import AgeRepartitionWidget from './widgets/AgeRepartitionWidget';
export default () => {
  return (
    <>
      <CRow>
        <CCol sm="4" lg="3">
          <TotalContactWidget />
        </CCol>
        <CCol sm="4" lg="3">
          <WorkableContactWidget />
        </CCol>
        <CCol sm="4" lg="3">
          <AvgContactsScoreWidget />
        </CCol>
      </CRow>

      <CRow>
        <CCol sm="12" lg="6" xl="4">
          <EspPieChartWidget />
        </CCol>

        <CCol sm="12" lg="6" xl="4">
          <StatusPieChartWidget />
        </CCol>

        <CCol sm="12" lg="6" xl="4">
          <GenderPieChartWidget />
        </CCol>
      </CRow>

      <CRow>
        <CCol sm="12" lg="6">
          <ScoreRepartitionWidget />
        </CCol>
        <CCol sm="12" lg="6">
          <AgeRepartitionWidget />
        </CCol>
      </CRow>
    </>
  );
};
