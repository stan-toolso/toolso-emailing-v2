import moment from 'moment-timezone';
import { CREATE_SCHEDULE, SENDING_CONFIGS } from '../../../../services/DatabaseQuery';
import { toast } from 'react-toastify';
import gql from 'graphql-tag';

const getNextScheduleDate = (schedule, content, fromDate) => {
  if (!fromDate) {
    fromDate = moment();
  }

  if (content && content.endDate && moment(content.endDate) < fromDate) {
    return null;
  }

  switch (schedule.type) {
    case 'recurrent':
      switch (schedule.rate) {
        case 'day': {
          let nextScheduleDate = moment(schedule.scheduleDate);
          let nextDate = fromDate;
          if (content && content.startDate && moment(content.startDate) > fromDate) {
            nextDate = moment(content.startDate);
          }
          nextScheduleDate = nextScheduleDate.set('year', nextDate.get('year')).set('month', nextDate.get('month')).set('date', nextDate.get('date'));
          if (nextScheduleDate < fromDate) {
            nextScheduleDate = nextScheduleDate.add(1, 'day');
          }
          return nextScheduleDate;
        }
        default:
          return null;
      }
    case 'single_send': {
      let nextScheduleDate = moment(schedule.scheduleDate);
      if (nextScheduleDate >= moment()) {
        return nextScheduleDate;
      }
      return null;
    }
    default:
      return null;
  }
};

const createSchedule = async (emailingDatabaseApiContext, name, type) => {
  try {
    let result = await emailingDatabaseApiContext.doQuery({
      query: CREATE_SCHEDULE,
      variables: {
        name,
        type
      }
    });
    if (result && result.data.createSchedule) {
      return JSON.parse(JSON.stringify(result.data.createSchedule));
    }
  } catch (err) {
    toast.error('Failed to create schedule', {
      position: toast.POSITION.BOTTOM_RIGHT
    });
  }
  return null;
};

const updateSchedule = async (emailingDatabaseApiContext, schedule, jsonObject, message, forceUpdate) => {
  jsonObject.id = schedule.id;

  try {
    let result = await emailingDatabaseApiContext.doMutation({
      mutation: gql`
        mutation updateSchedule($schedule: JSON!) {
          updateSchedule(schedule: $schedule) {
            id
            name
            isActive
            type
            config
            scheduleDate
            rate
            status
            sendingConfig {
              id
              name
            }
          }
        }
      `,
      variables: {
        schedule: jsonObject
      }
    });
    if (result && result.data.updateSchedule) {
      for (let key in result.data.updateSchedule) {
        schedule[key] = result.data.updateSchedule[key];
      }
      toast.success(message, {
        position: toast.POSITION.BOTTOM_RIGHT
      });

      forceUpdate();
    }
  } catch (err) {
    toast.error('Failed to update schedule', {
      position: toast.POSITION.BOTTOM_RIGHT
    });
  }
};

const getAllSendingConfigs = async (emailingDatabaseApiContext) => {
  try {
    let result = await emailingDatabaseApiContext.doQuery({
      query: SENDING_CONFIGS
    });
    if (result && result.data.sendingConfigs) {
      return result.data.sendingConfigs;
    }
  } catch (err) {
    toast.error('Failed to get sending configs', {
      position: toast.POSITION.BOTTOM_RIGHT
    });
  }
  return null;
};

const canActivateSchedule = (schedule) => {
  return (
    schedule.name != null &&
    schedule.sendingConfig &&
    ((schedule.type === 'recurrent' && schedule.scheduleDate && schedule.rate && schedule.sendingConfig) ||
      schedule.type === 'inscription' ||
      (schedule.type === 'single_send' && schedule.status === 'waiting' && moment(schedule.scheduleDate) > moment()))
  );
};

const canEditSchedule = (schedule) => {
  return (schedule.type !== 'single_send' && schedule.type !== 'recurrent_instance') || schedule.status === 'waiting';
};

const formatScheduleType = (schedule) => {
  switch (schedule.type) {
    case 'recurrent':
    case 'recurrent_instance':
      return 'Recurrent schedule';
    case 'single_send':
      return 'Single send';
    case 'inscription':
      return 'Inscription';
    default:
      return '';
  }
};

export { getNextScheduleDate, formatScheduleType, createSchedule, updateSchedule, getAllSendingConfigs, canActivateSchedule, canEditSchedule };
