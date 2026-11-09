import React from 'react';
import { CSpinner, CWidgetDropdown, CTooltip } from '@coreui/react';

export default ({ loading, scheduleContents, wantedType }) => {
  let averageMinNewContents = 0;
  if (scheduleContents) {
    let minNewContentsForLastSchedules = 0;
    if (wantedType) {
      minNewContentsForLastSchedules = scheduleContents
        .filter((schedule) => schedule.report && schedule.report.minNewContentsForContactByType && wantedType in schedule.report.minNewContentsForContactByType)
        .map((schedule) => schedule.report.minNewContentsForContactByType[wantedType]);
    } else {
      minNewContentsForLastSchedules = scheduleContents.filter((schedule) => schedule.report).map((schedule) => schedule.report.minNewContentsForContact);
    }

    const sum = minNewContentsForLastSchedules.reduce((a, b) => a + b, 0);
    averageMinNewContents = Math.round(sum / minNewContentsForLastSchedules.length) || 0;
  }

  if (loading) {
    return (
      <div className="card text-white bg-gradient-warning" style={{ textAlign: 'center', height: '95px' }}>
        <CSpinner animation="grow" color="warning" style={{ margin: 'auto' }} />
      </div>
    );
  }

  return (
    <CTooltip content="average number of new contents available for your best contacts since last week">
      <CWidgetDropdown
        style={{ paddingBottom: '20px', whiteSpace: 'nowrap' }}
        color="warning"
        header={averageMinNewContents ? averageMinNewContents.toString() : '0'}
        text="Minimum Contents choice"
      ></CWidgetDropdown>
    </CTooltip>
  );
};
