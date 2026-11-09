import ActiveContents from '../widgets/ActiveContents';
import FreshContents from '../widgets/FreshContents';
import LastClicksRateWidget from '../widgets/LastClicksRateWidget';
import FlopContents from './FlopContents';
import TopContents from './TopContents';
import ActiveWeeklyContents from '../widgets/ActiveWeeklyContents';
import { CRow, CCol } from '@coreui/react';
import React, { useState, useEffect } from 'react';

export default ({
  weeklyContents,
  loadingWeeklyContents,
  maxWantedItems,
  activeContents,
  loadingGlobalContents,
  delivContents,
  loadingDelivContents,
  scheduleContents,
  loadingScheduleContents,
  wantedType
}) => {
  const [newActiveCount, setNewActiveCounts] = useState(0);
  useEffect(() => {
    if (weeklyContents) {
      var activeWeeklyContents = weeklyContents.filter((content) => content.isActive);
      if (activeWeeklyContents) {
        setNewActiveCounts(activeWeeklyContents.length);
      }
    }
  }, [setNewActiveCounts, weeklyContents]);

  return (
    <>
      <CRow>
        <CCol sm="6" lg="3">
          <ActiveContents loading={loadingGlobalContents} activeContents={activeContents} />
        </CCol>
        <CCol sm="6" lg="3">
          <ActiveWeeklyContents newActiveCount={newActiveCount} loading={loadingWeeklyContents} />
        </CCol>
        <CCol sm="6" lg="3">
          <LastClicksRateWidget loading={loadingDelivContents} delivContents={delivContents} />
        </CCol>
        <CCol sm="6" lg="3">
          <FreshContents loading={loadingScheduleContents} scheduleContents={scheduleContents} wantedType={wantedType} />
        </CCol>
      </CRow>
      <CRow>
        <CCol>
          <TopContents weeklyContents={weeklyContents} loading={loadingWeeklyContents} maxWantedItems={Math.min(maxWantedItems, weeklyContents.length / 2)} />
        </CCol>
        <CCol>
          <FlopContents weeklyContents={weeklyContents} loading={loadingWeeklyContents} maxWantedItems={Math.min(maxWantedItems, weeklyContents.length / 2)} />
        </CCol>
      </CRow>
    </>
  );
};
