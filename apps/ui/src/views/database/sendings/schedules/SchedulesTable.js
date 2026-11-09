import { CLink, CSwitch } from '@coreui/react';
import React, { useContext } from 'react';
import { canActivateSchedule, updateSchedule, formatScheduleType, getNextScheduleDate } from './utils';
import EmailingDatabaseApiContext from '../../../../contexts/EmailingDatabaseApiContext';
import moment from 'moment-timezone';

export const ScheduleFields = {
  id: 'id',
  status: 'status',
  type: 'type',
  name: 'name',
  scheduleDate: 'scheduleDate',
  nextScheduleDate: 'nextScheduleDate',
  sending_config: 'sending_config',
  activeContentCount: 'activeContentCount'
};

const FIELDS_LABEL = {
  [ScheduleFields.id]: 'ID',
  [ScheduleFields.status]: 'Status',
  [ScheduleFields.scheduleDate]: 'Date',
  [ScheduleFields.nextScheduleDate]: 'Next Date',
  [ScheduleFields.type]: 'Type',
  [ScheduleFields.name]: 'Name',
  [ScheduleFields.sending_config]: 'Sending Config',
  [ScheduleFields.activeContentCount]: 'Active contents'
};

export const SchedulesTable = ({ fields, schedules, refetch }) => {
  if (!fields) {
    fields = Object.values(ScheduleFields);
  }
  return (
    <>
      <table className="table table-sm">
        <thead>
          <tr>
            {fields.map((field, index) => {
              return <th key={index}>{FIELDS_LABEL[field]}</th>;
            })}
          </tr>
        </thead>
        <tbody>
          {schedules.map((schedule) => {
            return (
              <tr key={schedule.id}>
                {fields.map((field) => {
                  return (
                    <td key={field}>
                      <ScheduleTd field={field} schedule={schedule} refetch={refetch} />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
};

const ScheduleTd = ({ schedule, field, refetch }) => {
  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);

  switch (field) {
    case ScheduleFields.id:
      return <span>#{schedule.id}</span>;
    case ScheduleFields.name:
      return (
        <span>
          <CLink to={`/${emailingDatabaseApiContext.getUid()}/sendings/schedules/${schedule.type}/${schedule.id}`}>{schedule.name}</CLink>
        </span>
      );
    case ScheduleFields.sending_config:
      return <span>{schedule.sendingConfig ? schedule.sendingConfig.name : ''}</span>;
    case ScheduleFields.activeContentCount:
      return <span>{schedule.contents ? schedule.contents.total : 0}</span>;
    case ScheduleFields.type:
      return <span>{formatScheduleType(schedule)}</span>;
    case ScheduleFields.scheduleDate:
      return <span>{schedule.scheduleDate ? moment(schedule.scheduleDate).format('YYYY-MM-DD HH:mm:ss') : ''}</span>;
    case ScheduleFields.nextScheduleDate: {
      const nextScheduleDate = getNextScheduleDate(schedule);
      return <span>{nextScheduleDate ? moment(nextScheduleDate).format('YYYY-MM-DD HH:mm:ss') : ''}</span>;
    }
    case ScheduleFields.status:
      return (
        <CSwitch
          className={'mx-1'}
          variant={'3d'}
          color={'primary'}
          size={'sm'}
          defaultChecked={schedule.isActive}
          disabled={!canActivateSchedule(schedule)}
          onChange={(e) => {
            updateSchedule(
              emailingDatabaseApiContext,
              schedule,
              {
                isActive: e.target.checked
              },
              e.target.checked ? `Schedule ${schedule.name} has been activated` : `Schedule ${schedule.name} has been disabled`,
              refetch
            );
          }}
        />
      );

    default:
      return null;
  }
};
