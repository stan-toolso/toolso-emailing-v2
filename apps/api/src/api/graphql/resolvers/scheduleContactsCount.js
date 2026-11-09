const log = require('../../../util/log').getLogger('contacts');

let _contactService = null;
let _contentService = null;
let _scheduleService = null;
module.exports = async (schedule, { contentId }, context, info) => {
  if (!_contactService) {
    let ContactService = require('../../../services/ContactService');
    let ContentService = require('../../../services/ContentService');
    let ScheduleService = require('../../../services/ScheduleService');

    _contactService = new ContactService();
    _contentService = new ContentService();
    _scheduleService = new ScheduleService();
  }
  if (schedule.status == 'sent') {
    return 0;
  }

  log.debug(`Count schedule contacts for schedule ${schedule.id} with content ${contentId} `);
  let { filter } = await _scheduleService.getFilterOfSchedule(schedule, false);

  if (contentId) {
    let content = await _contentService.findWithId(contentId);
    if (content && content.config && content.config.filters) {
      filter.children = [...filter.children, ...content.config.filters];
    }
  }

  try {
    let result = await _contactService.countAll(filter);
    return result;
  } catch (ex) {
    log.error(`Failed to count contact with filter ${JSON.stringify(filter)}`, ex);
    return 0;
  }
};
