import React from 'react';

import { CRow, CCol } from '@coreui/react';
import TodayClicksWidget from '../contents/widgets/TodayClicksWidget';
import TodayRequestsWidget from '../contents/widgets/TodayRequestsWidget';
import TodayBouncesWidget from '../contents/widgets/TodayBouncesWidget';
import TodayUnsubsAndComplaintsWidget from '../contents/widgets/TodayUnsubsAndComplaintsWidget';
import LastScheduleInstancesCard from './schedules/LastScheduleInstancesCard';
import RoutersStats from './RoutersStats';
export default () => {
  return (
    <>
      <CRow>
        <CCol sm="6" lg="3">
          <TodayRequestsWidget />
        </CCol>
        <CCol sm="6" lg="3">
          <TodayClicksWidget />
        </CCol>
        <CCol sm="6" lg="3">
          <TodayUnsubsAndComplaintsWidget />
        </CCol>
        <CCol sm="6" lg="3">
          <TodayBouncesWidget />
        </CCol>
      </CRow>
      <CRow>
        <CCol>
          <LastScheduleInstancesCard />
        </CCol>
      </CRow>
      <CRow>
        <CCol>
          <RoutersStats />
        </CCol>
      </CRow>
    </>
  );
};
