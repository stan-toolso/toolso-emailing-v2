import React from 'react';
import { CSpinner, CWidgetDropdown, CTooltip } from '@coreui/react';
import { calculateAndFormatPercent } from '../../../util';

export default ({ loading, delivContents }) => {
  let clickRate = undefined;
  if (delivContents) {
    const totalStatsForLastSchedules = delivContents.filter((delivContent) => delivContent.totalStats).map((delivContent) => delivContent.totalStats);
    const sumRequests = totalStatsForLastSchedules.map((totalStat) => totalStat.request).reduce((a, b) => a + b, 0);
    const sumClicks = totalStatsForLastSchedules.map((totalStat) => totalStat.unique_click).reduce((a, b) => a + b, 0);
    clickRate = calculateAndFormatPercent(sumClicks, sumRequests);
  }

  if (loading) {
    return (
      <div className="card text-white bg-gradient-info" style={{ textAlign: 'center', height: '95px' }}>
        <CSpinner animation="grow" color="info" style={{ margin: 'auto' }} />
      </div>
    );
  }

  return (
    <CTooltip content="average click rate of your contents for last week">
      <CWidgetDropdown style={{ paddingBottom: '20px' }} color="info" header={clickRate} text="Click rate"></CWidgetDropdown>
    </CTooltip>
  );
};
