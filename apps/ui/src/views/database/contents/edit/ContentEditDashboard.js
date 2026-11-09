import React from 'react';
import { CCol, CRow, CWidgetDropdown } from '@coreui/react';

import { calculateAndFormatPercent, formatInteger, formatFloat } from '../../../common/util';
import DelivStats from '../../sendings/deliv/DelivStats';

export default ({ content }) => {
  if (!content || !content.delivStats) {
    return null;
  }
  return (
    <>
      <CRow>
        <CCol sm="6" lg="3">
          <CWidgetDropdown color="gradient-primary" header={formatInteger(content.delivStats.request)} text="Total requests"></CWidgetDropdown>
        </CCol>
        <CCol sm="6" lg="3">
          <CWidgetDropdown color="gradient-info" header={calculateAndFormatPercent(content.delivStats.unique_open, content.delivStats.request)} text="Unique open rate"></CWidgetDropdown>
        </CCol>
        <CCol sm="6" lg="3">
          {content.incomesStats?.total?.eCpm > 0 && <CWidgetDropdown color="gradient-warning" header={`${formatFloat(content.incomesStats.total.eCpm)} €`} text="eCpm"></CWidgetDropdown>}
          {!content.incomesStats?.total?.eCpm && (
            <CWidgetDropdown color="gradient-warning" header={calculateAndFormatPercent(content.delivStats.unique_click, content.delivStats.request)} text="Unique click rate"></CWidgetDropdown>
          )}
        </CCol>
        <CCol sm="6" lg="3">
          <CWidgetDropdown color="gradient-danger" header={calculateAndFormatPercent(content.delivStats.complaint, content.delivStats.delivered)} text="Complaint rate"></CWidgetDropdown>
        </CCol>
      </CRow>
      <CRow>
        <CCol sm="12">
          <DelivStats defaultFilter={{ content: content.id }} showIncome={true} />
        </CCol>
      </CRow>
    </>
  );
};
