import React from 'react';
import { CCol, CRow } from '@coreui/react';
import TodayInscriptionsWidget from './widgets/TodayInscriptionsWidget';
import ByEspOrSubSourceInscriptionStatsCard from '../inscriptions/ByEspOrSubSourceInscriptionStatsCard';
import TodayActivationWidget from './widgets/TodayActivationWidget';
import TodayNewsRateWidget from './widgets/TodayNewsRateWidget';

export default ({ source }) => {
  return (
    <>
      <CRow>
        <CCol sm="6" lg="3">
          <TodayInscriptionsWidget source={source} />
        </CCol>
        <CCol sm="6" lg="3">
          <TodayActivationWidget source={source} />
        </CCol>
        <CCol sm="6" lg="3">
          <TodayNewsRateWidget source={source} />
        </CCol>
      </CRow>
      <CRow>
        <CCol sm="12">
          <ByEspOrSubSourceInscriptionStatsCard source={source} />
        </CCol>
      </CRow>
    </>
  );
};
