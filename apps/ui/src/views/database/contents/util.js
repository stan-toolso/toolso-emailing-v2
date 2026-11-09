import { UPDATE_CONTENT, DELETE_CONTENT, UPDATE_CONTENT_VERSION, UNSCHEDULE_CONTENT, SCHEDULE_CONTENT } from '../../../services/DatabaseQuery';
import { toast } from 'react-toastify';

const canActivateContent = (content) => {
  return content.name != null && !content.suspended;
  //plus tard, il faudrait vérifier qu'au moins une version est valide
  /*return (content.name != null && (content.defaultVersion ||  && 
        ((content.defaultVersion.html && content.defaultVersion.subject)
        ||
        content.defaultVersion.contentTemplate
        )

    );*/
};

const canDeleteContent = (content) => {
  return !content.delivStats || !content.delivStats.request;
};

const updateContent = async (emailingDatabaseApiContext, content, jsonObject, message, forceUpdate) => {
  jsonObject.id = content.id;

  try {
    let result = await emailingDatabaseApiContext.doQuery({
      query: UPDATE_CONTENT,
      variables: {
        content: jsonObject
      },
      fetchPolicy: 'network-only'
    });
    if (result && result.data.updateContent) {
      for (let key in result.data.updateContent) {
        if (key in content) {
          content[key] = JSON.parse(JSON.stringify(result.data.updateContent[key]));
        }
      }
      toast.success(message, {
        position: toast.POSITION.BOTTOM_RIGHT
      });
      forceUpdate && forceUpdate();
    }
  } catch (err) {
    console.error(err);
    toast.error('Failed to update content', {
      position: toast.POSITION.BOTTOM_RIGHT
    });
  }
};

const updateContentVersion = async (emailingDatabaseApiContext, contentVersion, jsonObject, message, forceUpdate) => {
  jsonObject.id = contentVersion.id;
  try {
    let result = await emailingDatabaseApiContext.doQuery({
      query: UPDATE_CONTENT_VERSION,
      variables: {
        contentVersion: jsonObject
      },
      fetchPolicy: 'network-only'
    });
    if (result && result.data.updateContentVersion) {
      for (let key in result.data.updateContentVersion) {
        contentVersion[key] = JSON.parse(JSON.stringify(result.data.updateContentVersion[key]));
      }
      toast.success(message, {
        position: toast.POSITION.BOTTOM_RIGHT
      });

      forceUpdate && forceUpdate();
    }
  } catch (err) {
    console.log(err);
    toast.error(`Failed to update content version : ${err.message}`, {
      position: toast.POSITION.BOTTOM_RIGHT
    });
  }
};

const deleteContent = async (emailingDatabaseApiContext, contents, content, forceUpdate) => {
  try {
    let result = await emailingDatabaseApiContext.doQuery({
      query: DELETE_CONTENT,
      variables: {
        contentId: content.id
      },
      fetchPolicy: 'network-only'
    });
    if (result && result.data) {
      toast.success(`Content ${content.name} has been deleted`, {
        position: toast.POSITION.BOTTOM_RIGHT
      });
      contents.splice(contents.indexOf(content), 1);
      forceUpdate();
    }
  } catch (err) {
    toast.error('Failed to delete content.', {
      position: toast.POSITION.BOTTOM_RIGHT
    });
  }
};

const unscheduleContent = async (emailingDatabaseApiContext, content, schedule, forceUpdate) => {
  try {
    let result = await emailingDatabaseApiContext.doQuery({
      query: UNSCHEDULE_CONTENT,
      variables: {
        contentId: content.id,
        scheduleId: schedule.id
      },
      fetchPolicy: 'network-only'
    });
    if (result && result.data.unscheduleContent === 'ok') {
      content.schedules.splice(content.schedules.indexOf(schedule), 1);
      toast.success(`Schedule ${schedule.name} has been unscheduled from content ${content.name}`, {
        position: toast.POSITION.BOTTOM_RIGHT
      });

      forceUpdate();
      return;
    }
  } catch (err) {
    console.error(err);
  }
  toast.error('Failed to unschedule content', {
    position: toast.POSITION.BOTTOM_RIGHT
  });
};

const scheduleContent = async (emailingDatabaseApiContext, content, schedule, forceUpdate) => {
  try {
    let result = await emailingDatabaseApiContext.doQuery({
      query: SCHEDULE_CONTENT,
      variables: {
        contentId: content.id,
        scheduleId: schedule.id
      },
      fetchPolicy: 'network-only'
    });
    if (result && result.data.scheduleContent === 'ok') {
      content.schedules.push(schedule);

      toast.success(`Schedule ${schedule.name} has been scheduled from content ${content.name}`, {
        position: toast.POSITION.BOTTOM_RIGHT
      });

      forceUpdate();
      return;
    }
  } catch (err) {
    console.error(err);
  }
  toast.error('Failed to schedule content', {
    position: toast.POSITION.BOTTOM_RIGHT
  });
};
export { canActivateContent, updateContent, updateContentVersion, canDeleteContent, deleteContent, unscheduleContent, scheduleContent };
