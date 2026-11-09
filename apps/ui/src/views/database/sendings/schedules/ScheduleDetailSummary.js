import React from 'react';
import { CCard, CCardBody, CCardHeader, CCol, CRow, CWidgetDropdown } from '@coreui/react';

import { calculateAndFormatPercent, formatFloat, formatInteger } from '../../../common/util';
//import { getNextScheduleDate } from './utils';

export default ({ schedule }) => {
  const totalStats = schedule.dimensionDelivStats && schedule.dimensionDelivStats.dimensionsStats.length > 0 ? schedule.dimensionDelivStats.dimensionsStats[0].totalStats : null;

  //const nextScheduleDate = getNextScheduleDate(schedule, null, date);
  return (
    <>
      {totalStats && (
        <CRow>
          <CCol sm="6" lg="3">
            <CWidgetDropdown color="gradient-primary" header={formatInteger(totalStats.request)} text="Total requests"></CWidgetDropdown>
          </CCol>
          <CCol sm="6" lg="3">
            <CWidgetDropdown color="gradient-info" header={calculateAndFormatPercent(totalStats.unique_open, totalStats.request)} text="Unique open rate"></CWidgetDropdown>
          </CCol>
          <CCol sm="6" lg="3">
            <CWidgetDropdown color="gradient-warning" header={calculateAndFormatPercent(totalStats.unique_click, totalStats.request)} text="Unique click rate"></CWidgetDropdown>
          </CCol>
          <CCol sm="6" lg="3">
            <CWidgetDropdown color="gradient-danger" header={calculateAndFormatPercent(totalStats.unsub, totalStats.unique_open)} text="Unsub rate"></CWidgetDropdown>
          </CCol>
        </CRow>
      )}
      {schedule.status === 'waiting' && (
        <CRow>
          <CCol sm="6" lg="6">
            <CWidgetDropdown color="gradient-primary" header={formatInteger(schedule.contents.total)} text="Scheduled content"></CWidgetDropdown>
          </CCol>
          <CCol sm="6" lg="6">
            <CWidgetDropdown color="gradient-info" header={formatInteger(schedule.contactsCount)} text="Contacts scheduled"></CWidgetDropdown>
          </CCol>
        </CRow>
      )}
      <CRow>
        {schedule.status === 'sent' && totalStats && (
          <CCol sm="4" lg="4">
            <CCard>
              <CCardHeader className="pl-1">Activity</CCardHeader>
              <CCardBody className="p-0">
                <table className="table table-sm table-striped m-0">
                  <tbody>
                    <tr>
                      <td>Opens</td>
                      <td>{formatInteger(totalStats.open)}</td>
                    </tr>
                    <tr>
                      <td>Unique opens</td>
                      <td>{formatInteger(totalStats.unique_open)}</td>
                    </tr>
                    <tr>
                      <td>Clicks</td>
                      <td>{formatInteger(totalStats.click)}</td>
                    </tr>
                    <tr>
                      <td>Unique clicks</td>
                      <td>{formatInteger(totalStats.unique_click)}</td>
                    </tr>
                    <tr>
                      <td>Unsub</td>
                      <td>{formatInteger(totalStats.unsub)}</td>
                    </tr>
                    <tr>
                      <td>Complaints</td>
                      <td>{formatInteger(totalStats.complaint)}</td>
                    </tr>
                    <tr>
                      <td>Soft Bounces</td>
                      <td>{formatInteger(totalStats.soft_bounce)}</td>
                    </tr>
                    <tr>
                      <td>Hard Bounces</td>
                      <td>{formatInteger(totalStats.hard_bounce)}</td>
                    </tr>
                  </tbody>
                </table>
              </CCardBody>
            </CCard>
          </CCol>
        )}
        {schedule.status === 'sent' && schedule.report && (
          <>
            <CCol sm="4" lg="4">
              <CCard>
                <CCardHeader className="pl-1">Contents</CCardHeader>
                <CCardBody className="p-0">
                  <table className="table table-sm table-striped m-0">
                    <tbody>
                      <tr>
                        <td>Max contents for contact</td>
                        <td>{formatInteger(schedule.report.maxContentsForContact)}</td>
                      </tr>
                      <tr>
                        <td>Min contents for contact</td>
                        <td>{formatInteger(schedule.report.minContentsForContact)}</td>
                      </tr>
                      <tr>
                        <td>Avg contents for contact</td>
                        <td>{formatFloat(schedule.report.avgContentsForContact)}</td>
                      </tr>
                      <tr>
                        <td>Max new contents for contact</td>
                        <td>{formatInteger(schedule.report.maxNewContentsForContact)}</td>
                      </tr>
                      <tr>
                        <td>Min new contents for contact</td>
                        <td>{formatInteger(schedule.report.minNewContentsForContact)}</td>
                      </tr>
                      <tr>
                        <td>Avg new contents for contact</td>
                        <td>{formatFloat(schedule.report.avgNewContentsForContact)}</td>
                      </tr>
                      <tr>
                        <td>Contacts without new contents</td>
                        <td>{schedule.report.noNewContentContacts ? formatInteger(schedule.report.noNewContentContacts) : 0}</td>
                      </tr>
                    </tbody>
                  </table>
                </CCardBody>
              </CCard>
            </CCol>
            <CCol sm="4" lg="4">
              <CCard>
                <CCardHeader className="pl-1">No Requests</CCardHeader>
                <CCardBody className="p-0">
                  <table className="table table-sm table-striped m-0">
                    <tbody>
                      <tr>
                        <td>Total No Requests</td>
                        <td>{schedule.report.no_requests ? formatInteger(schedule.report.no_requests) : 0}</td>
                      </tr>
                      <tr>
                        <td>Contact without Content</td>
                        <td>{schedule.report.no_requests_reasons && schedule.report.no_requests_reasons.no_content ? formatInteger(schedule.report.no_requests_reasons.no_content) : 0}</td>
                      </tr>
                      <tr>
                        <td>Marketing Pressure</td>
                        <td>
                          {schedule.report.no_requests_reasons && schedule.report.no_requests_reasons.pression_marketing_filter
                            ? formatInteger(schedule.report.no_requests_reasons.pression_marketing_filter)
                            : 0}
                        </td>
                      </tr>
                      <tr>
                        <td>Insufficient score</td>
                        <td>{schedule.report.no_requests_reasons && schedule.report.no_requests_reasons.score_filtered ? formatInteger(schedule.report.no_requests_reasons.score_filtered) : 0}</td>
                      </tr>
                      <tr>
                        <td>Already Scheduled</td>
                        <td>
                          {schedule.report.no_requests_reasons && schedule.report.no_requests_reasons.already_scheduled ? formatInteger(schedule.report.no_requests_reasons.already_scheduled) : 0}
                        </td>
                      </tr>
                      <tr>
                        <td>Incorrect Status</td>
                        <td>{schedule.report.no_requests_reasons && schedule.report.no_requests_reasons.status_filter ? formatInteger(schedule.report.no_requests_reasons.status_filter) : 0}</td>
                      </tr>
                    </tbody>
                  </table>
                </CCardBody>
              </CCard>
            </CCol>
          </>
        )}
      </CRow>
    </>
  );
};
