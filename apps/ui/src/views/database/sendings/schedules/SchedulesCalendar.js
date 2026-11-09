import React, { useContext, useState } from 'react';

import gql from 'graphql-tag';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';

import EmailingDatabaseApiContext from '../../../../contexts/EmailingDatabaseApiContext';
import moment from 'moment-timezone';
import { getNextScheduleDate } from './utils';
import ScheduleDetailModal from './ScheduleDetailModal';

export default () => {
  const [detailedSchedule, setDetailedSchedule] = useState(null);
  const [detailedDate, setDetailedDate] = useState(null);

  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);

  return (
    <>
      <ScheduleDetailModal
        scheduleId={detailedSchedule ? detailedSchedule.id : null}
        date={detailedDate}
        close={() => {
          setDetailedSchedule(null);
        }}
      />

      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        weekends={true}
        contentHeight={'auto'}
        eventSources={[
          {
            events: async (info, successCallback) => {
              let fromDate = moment(info.start);
              let toDate = moment(info.end);

              let result = await emailingDatabaseApiContext.doQuery({
                query: gql`
                  query schedules($limit: Int, $offset: Int, $filter: JSON) {
                    schedules(limit: $limit, offset: $offset, filter: $filter) {
                      schedules {
                        id
                        isActive
                        name
                        type
                        status
                        scheduleDate
                        rate
                      }
                    }
                  }
                `,
                variables: {
                  filter: {
                    fromDate: fromDate.format('YYYY-MM-DD'),
                    toDate: toDate.format('YYYY-MM-DD'),
                    forCalendar: true
                  },
                  offset: 0,
                  limit: 500
                }
              });
              if (result) {
                let schedules = JSON.parse(JSON.stringify(result.data.schedules.schedules));
                successCallback(schedulesToEventList(fromDate, toDate, schedules));
              }
            },

            color: 'yellow', // an option!
            textColor: 'black' // an option!
          }
        ]}
        eventContent={ScheduleDisplay(setDetailedSchedule, setDetailedDate)}
      />
    </>
  );
};

const schedulesToEventList = (fromDate, toDate, schedules) => {
  let events = [];
  for (let schedule of schedules) {
    let event = {
      id: schedule.id,
      title: schedule.name,
      schedule: schedule,
      date: moment(schedule.scheduleDate).toDate(),
      scheduleDate: moment(schedule.scheduleDate),
      allDay: false
    };
    switch (schedule.type) {
      case 'recurrent_instance':
        event.classNames = ['bg-primary', 'text-white'];
        events.push(event);
        break;
      case 'single_send':
        event.classNames = schedule.isActive || schedule.status === 'sent' ? ['bg-success', 'text-white'] : ['bg-light'];

        events.push(event);
        break;
      case 'recurrent':
        events = [...events, ...getNextRecurrentEvents(moment(), toDate, schedule)];
        break;
      default:
        break;
    }
  }

  return events;
};

const getNextRecurrentEvents = (currentDate, toDate, schedule) => {
  let events = [];
  if (!schedule.isActive) {
    return events;
  }

  while (currentDate < toDate) {
    let nextDate = getNextScheduleDate(schedule, null, currentDate);
    if (!nextDate) {
      return events;
    }
    let event = {
      title: schedule.name,
      id: `${schedule.id}_${nextDate.toString()}`,
      date: nextDate.toDate(),
      schedule: schedule,
      scheduleDate: nextDate,
      classNames: schedule.isActive ? ['bg-info', 'text-white'] : ['bg-light']
    };
    events.push(event);
    currentDate = nextDate.clone().add(1, 'minute');
  }

  return events;
};

const ScheduleDisplay = (setDetailedSchedule, setDetailedDate) => {
  return (item) => {
    return (
      <div
        className="pl-1"
        style={{ overflow: 'hidden', cursor: 'pointer' }}
        onClick={() => {
          setDetailedDate(item.event.extendedProps.scheduleDate);
          setDetailedSchedule(item.event.extendedProps.schedule);
        }}
      >
        {getScheduleIcon(item.event.extendedProps.schedule)}
        {item.event.extendedProps.scheduleDate.format('HH:mm')} - {item.event.title}
      </div>
    );
  };
};
const getScheduleIcon = (schedule) => {
  switch (schedule.type) {
    case 'recurrent_instance':
    case 'single_send':
      if (schedule.status === 'sent') {
        return <i className="fas fa-check pr-1"></i>;
      } else if (schedule.status === 'waiting' && schedule.isActive) {
        return <i className="far fa-clock pr-1"></i>;
      } else if (schedule.status === 'waiting' && !schedule.isActive) {
        return <i className="far fa-edit pr-1"></i>;
      }
      break;
    case 'recurrent':
      if (schedule.isActive) {
        return <i className="far fa-clock pr-1"></i>;
      }
      break;

    default:
      break;
  }
  return null;
};
