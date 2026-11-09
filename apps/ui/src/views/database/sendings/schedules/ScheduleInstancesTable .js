import { CLink, CSpinner, CSwitch } from '@coreui/react';
import React, { useContext } from 'react';
import { canActivateSchedule, updateSchedule, formatScheduleType, getNextScheduleDate } from './utils';
import EmailingDatabaseApiContext from '../../../../contexts/EmailingDatabaseApiContext';
import moment from 'moment-timezone';
import { calculateAndFormatPercent, formatInteger } from '../../../util';
import { getEstimateOpeners } from '../deliv/delivKpis';

export const ScheduleInstanceFields = {
  id: 'id',
  status: 'status',
  type: 'type',
  name: 'name',
  scheduleDate: 'scheduleDate',
  nextScheduleDate: 'nextScheduleDate',
  sending_config: 'sending_config',
  activeContentCount: 'activeContentCount',
  request: 'request',
  unique_open: 'unique_open',
  openers: 'openers',
  unique_click: 'unique_click',
  unsub: 'unsub',
  bounces: 'bounces'
};

const LABELS = {
  [ScheduleInstanceFields.id]: 'ID',
  [ScheduleInstanceFields.status]: 'Status',
  [ScheduleInstanceFields.scheduleDate]: 'Date',
  [ScheduleInstanceFields.nextScheduleDate]: 'Next Date',
  [ScheduleInstanceFields.type]: 'Type',
  [ScheduleInstanceFields.name]: 'Name',
  [ScheduleInstanceFields.sending_config]: 'Sending Config',
  [ScheduleInstanceFields.activeContentCount]: 'Active contents',
  [ScheduleInstanceFields.request]: 'Requests',
  [ScheduleInstanceFields.unique_open]: 'Unique Open',
  [ScheduleInstanceFields.openers]: 'Openers',
  [ScheduleInstanceFields.unique_click]: 'Clickers',
  [ScheduleInstanceFields.unsub]: 'Unsubs',
  [ScheduleInstanceFields.bounces]: 'Bounces'
};

export const ScheduleInstancesTable = ({ fields, schedules, refetch, loading }) => {
  if (!fields) {
    fields = Object.values(ScheduleInstanceFields);
  }
  return (
    <>
      <table className="table table-sm">
        <thead>
          <tr>
            {fields.map((field, index) => {
              return <th key={index}>{LABELS[field]}</th>;
            })}
          </tr>
        </thead>
        {loading && (
          <tbody>
            <tr>
              <td colSpan={fields.length}>
                <div style={{ textAlign: 'center', padding: '30px 0px' }}>
                  <CSpinner animation="grow" color="secondary" />
                </div>
              </td>
            </tr>
          </tbody>
        )}
        {!loading && (
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
        )}
      </table>
    </>
  );
};

const ScheduleTd = ({ schedule, field, refetch }) => {
  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);

  switch (field) {
    case ScheduleInstanceFields.id:
      return <span>#{schedule.id}</span>;
    case ScheduleInstanceFields.name:
      return (
        <span>
          <CLink to={`/${emailingDatabaseApiContext.getUid()}/sendings/schedules/${schedule.type}/${schedule.id}`}>{schedule.name}</CLink>
        </span>
      );
    case ScheduleInstanceFields.sending_config:
      return <span>{schedule.sendingConfig ? schedule.sendingConfig.name : ''}</span>;
    case ScheduleInstanceFields.activeContentCount:
      return <span>{schedule.contents ? schedule.contents.total : 0}</span>;
    case ScheduleInstanceFields.type:
      return <span>{formatScheduleType(schedule)}</span>;
    case ScheduleInstanceFields.scheduleDate:
      return <span>{schedule.scheduleDate ? moment(schedule.scheduleDate).format('YYYY-MM-DD HH:mm:ss') : ''}</span>;
    case ScheduleInstanceFields.nextScheduleDate: {
      const nextScheduleDate = getNextScheduleDate(schedule);
      return <span>{nextScheduleDate ? moment(nextScheduleDate).format('YYYY-MM-DD HH:mm:ss') : ''}</span>;
    }
    case ScheduleInstanceFields.request:
      return <span>{schedule.dimensionDelivStats && schedule.dimensionDelivStats.totalStats ? formatInteger(schedule.dimensionDelivStats.totalStats.request) : 0}</span>;

    case ScheduleInstanceFields.unique_open:
      return (
        <span className="text-info">
          {schedule.dimensionDelivStats && schedule.dimensionDelivStats.totalStats ? formatInteger(schedule.dimensionDelivStats.totalStats.unique_open) : 0}
          <small className="text-muted">
            {schedule.dimensionDelivStats &&
              schedule.dimensionDelivStats.totalStats &&
              schedule.dimensionDelivStats &&
              schedule.dimensionDelivStats.totalStats.request &&
              ' (' + calculateAndFormatPercent(schedule.dimensionDelivStats.totalStats.unique_open, schedule.dimensionDelivStats.totalStats.request) + ')'}
          </small>
        </span>
      );
    case ScheduleInstanceFields.openers:
      return (
        <span className="text-info">
          {schedule.dimensionDelivStats && schedule.dimensionDelivStats.totalStats ? formatInteger(getEstimateOpeners(schedule.dimensionDelivStats.totalStats)) : 0}
          <small className="text-muted">
            {schedule.dimensionDelivStats &&
              schedule.dimensionDelivStats.totalStats &&
              schedule.dimensionDelivStats &&
              schedule.dimensionDelivStats.totalStats.request &&
              ' (' + calculateAndFormatPercent(getEstimateOpeners(schedule.dimensionDelivStats.totalStats), schedule.dimensionDelivStats.totalStats.request) + ')'}
          </small>
        </span>
      );

    case ScheduleInstanceFields.unique_click:
      return (
        <span className="text-success">
          {schedule.dimensionDelivStats && schedule.dimensionDelivStats.totalStats ? formatInteger(schedule.dimensionDelivStats.totalStats.unique_click) : 0}
          <small className="text-muted">
            {schedule.dimensionDelivStats &&
              schedule.dimensionDelivStats.totalStats &&
              schedule.dimensionDelivStats &&
              schedule.dimensionDelivStats.totalStats.request &&
              ' (' + calculateAndFormatPercent(schedule.dimensionDelivStats.totalStats.unique_click, schedule.dimensionDelivStats.totalStats.request) + ')'}
          </small>
        </span>
      );
    case ScheduleInstanceFields.unsub:
      return (
        <span className="text-warning">
          {schedule.dimensionDelivStats && schedule.dimensionDelivStats.totalStats ? formatInteger(schedule.dimensionDelivStats.totalStats.unsub) : 0}
          <small className="text-muted">
            {schedule.dimensionDelivStats &&
              schedule.dimensionDelivStats.totalStats &&
              schedule.dimensionDelivStats &&
              schedule.dimensionDelivStats.totalStats.request &&
              ' (' + calculateAndFormatPercent(schedule.dimensionDelivStats.totalStats.unsub, schedule.dimensionDelivStats.totalStats.request) + ')'}
          </small>
        </span>
      );
    case ScheduleInstanceFields.bounces:
      return (
        <span className="text-danger">
          {schedule.dimensionDelivStats && schedule.dimensionDelivStats.totalStats ? formatInteger(getTotalBouncesFromSchedule(schedule)) : 0}
          <small className="text-muted">
            {schedule.dimensionDelivStats &&
              schedule.dimensionDelivStats.totalStats &&
              schedule.dimensionDelivStats &&
              schedule.dimensionDelivStats.totalStats.request &&
              ' (' + calculateAndFormatPercent(getTotalBouncesFromSchedule(schedule), schedule.dimensionDelivStats.totalStats.request) + ')'}
          </small>
        </span>
      );

    case ScheduleInstanceFields.status:
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

function getTotalBouncesFromSchedule(schedule) {
  let stats = schedule.dimensionDelivStats.totalStats;
  let result = stats.soft_bounce + stats.hard_bounce;
  if (stats.content_bounce) {
    result += stats.content_bounce;
  }
  if (stats.contact_bounce) {
    result += stats.contact_bounce;
  }
  return result;
}
