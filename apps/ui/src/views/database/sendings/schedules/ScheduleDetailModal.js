import React, { useContext, useState } from 'react';
import { CModal, CModalBody, CModalHeader, CSwitch } from '@coreui/react';

import moment from 'moment-timezone';
import { canActivateSchedule, getNextScheduleDate, updateSchedule } from './utils';
import { ScheduleEdit } from './ScheduleEdit';

import EmailingDatabaseApiContext from '../../../../contexts/EmailingDatabaseApiContext';

export default ({ scheduleId, close, date, defaultSection }) => {
  const [schedule, setSchedule] = useState(null);
  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);

  const nextScheduleDate = schedule ? getNextScheduleDate(schedule, null, date) : null;

  return (
    <>
      <CModal
        show={scheduleId !== null}
        color="info"
        size="lg"
        onClose={() => {
          close();
        }}
      >
        <CModalHeader>
          {schedule && (
            <span>
              <CSwitch
                className={'mx-1 float-left mr-3 '}
                variant={'3d'}
                color={'primary'}
                size={'sm'}
                checked={schedule.isActive}
                disabled={!canActivateSchedule(schedule)}
                onChange={(e) => {
                  updateSchedule(
                    emailingDatabaseApiContext,
                    schedule,
                    {
                      isActive: e.target.checked
                    },
                    e.target.checked ? `Schedule ${schedule.name} has been activated` : `Schedule ${schedule.name} has been disabled`,
                    () => {
                      setSchedule({ ...schedule });
                    }
                  );
                }}
              />

              {schedule.name}
              {(schedule.type === 'recurrent_instance' || schedule.type === 'single_send') && <small>&nbsp;&nbsp;({moment(schedule.scheduleDate).format('YYYY-MM-DD HH:mm:ss')})</small>}
              {schedule.type === 'recurrent' && nextScheduleDate && <small>&nbsp;&nbsp;({nextScheduleDate.format('YYYY-MM-DD HH:mm:ss')})</small>}
            </span>
          )}
        </CModalHeader>

        <CModalBody>
          <ScheduleEdit scheduleId={scheduleId} date={date} onScheduleChanged={setSchedule} defaultSection={defaultSection} />
        </CModalBody>
      </CModal>
    </>
  );
};
