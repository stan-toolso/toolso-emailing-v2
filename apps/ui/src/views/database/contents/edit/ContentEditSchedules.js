import { CButton, CCard, CCardBody, CCardHeader, CCol, CRow } from '@coreui/react';
import React, { useContext, useState } from 'react';

import EmailingDatabaseApiContext from '../../../../contexts/EmailingDatabaseApiContext';
import { unscheduleContent } from '../util';
import { getNextScheduleDate, formatScheduleType } from '../../sendings/schedules/utils';
import { formatInteger } from '../../../util';
import ScheduleContentModal from './ScheduleContentModal';
import ScheduleDetailModal from '../../sendings/schedules/ScheduleDetailModal';

export default ({ content, forceUpdate, emailingDatabaseApi }) => {
  if (!content.schedules) {
    content.schedules = [];
  }
  const [showScheduleContentModal, setShowScheduleContentModal] = useState(false);
  const [detailedSchedule, setDetailedSchedule] = useState(null);

  return (
    <>
      <div className="mb-2">
        <CButton
          onClick={() => {
            setShowScheduleContentModal(true);
          }}
          color="primary"
          size="sm"
        >
          Schedule your content
        </CButton>
      </div>

      {content.schedules.map((schedule, index) => {
        return <ContentSchedule key={index} schedule={schedule} content={content} forceUpdate={forceUpdate} setDetailedSchedule={setDetailedSchedule} emailingDatabaseApi={emailingDatabaseApi} />;
      })}
      <ScheduleDetailModal
        scheduleId={detailedSchedule ? detailedSchedule.id : null}
        close={() => {
          setDetailedSchedule(null);
        }}
        defaultSection="settings"
      />

      <ScheduleContentModal
        contentId={content.id}
        content={content}
        show={showScheduleContentModal}
        toggle={() => {
          setShowScheduleContentModal(false);
        }}
        forceUpdate={forceUpdate}
        emailingDatabaseApi={emailingDatabaseApi}
      />
    </>
  );
};

const ContentSchedule = ({ content, schedule, forceUpdate, setDetailedSchedule, emailingDatabaseApi }) => {
  const emailingDatabaseApiContext = emailingDatabaseApi ?? useContext(EmailingDatabaseApiContext);

  let nextScheduleDate = getNextScheduleDate(schedule, content);
  return (
    <CCard color="secondary">
      <CCardHeader>
        #{schedule.id} : {schedule.name}
      </CCardHeader>
      <CCardBody className="pt-1">
        {schedule.type !== 'inscription' && (
          <CRow>
            <CCol sm="6" lg="3">
              <div className="callout callout-secondary">
                <small className="text-muted">Schedule type</small>
                <br />
                <strong>{formatScheduleType(schedule)}</strong>
              </div>
            </CCol>
            {schedule.type !== 'inscription' && nextScheduleDate && (
              <CCol sm="6" lg="3">
                <div className="callout callout-secondary">
                  <small className="text-muted">Next schedule</small>
                  <br />
                  <strong>{nextScheduleDate.format('YYYY/MM/DD HH:mm:ss')}</strong>
                </div>
              </CCol>
            )}
            {schedule.type !== 'inscription' && (
              <CCol sm="6" lg="3">
                <div className="callout callout-secondary">
                  <small className="text-muted">Contact schedules</small>
                  <br />
                  <strong>{formatInteger(schedule.contactsCount)}</strong>
                </div>
              </CCol>
            )}
          </CRow>
        )}

        {schedule.type === 'inscription' && <p>Next schedule will come with next inscription configured with this schedule (#{schedule.id}).</p>}

        <CRow>
          <CCol xl={12}>
            <CButton
              className="mr-2"
              size="sm"
              color="primary"
              onClick={() => {
                setDetailedSchedule(schedule);
              }}
            >
              Edit
            </CButton>

            <CButton
              className="mr-2"
              size="sm"
              color="danger"
              onClick={() => {
                unscheduleContent(emailingDatabaseApiContext, content, schedule, forceUpdate);
              }}
            >
              Unschedule
            </CButton>
          </CCol>
        </CRow>
      </CCardBody>
    </CCard>
  );
};
