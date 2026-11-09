let ContentService = require('../../../services/ContentService');
const log = require('../../../util/log').getLogger('Unschedule content');

let _contentService = null;
module.exports = async (parent, { contentId, scheduleId }, context, info) => {
  if (!_contentService) {
    _contentService = new ContentService();
  }

  log.debug(`Unschedule content ${contentId} with schedule ${scheduleId}`);
  if (await _contentService.unscheduleContent(contentId, scheduleId)) {
    return 'ok';
  } else {
    return 'ko';
  }
};
