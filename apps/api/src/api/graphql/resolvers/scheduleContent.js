let ContentService = require('../../../services/ContentService');
const log = require('../../../util/log').getLogger('Schedule content');

let _contentService = null;
module.exports = async (parent, { contentId, scheduleId }, context, info) => {
  if (!_contentService) {
    _contentService = new ContentService();
  }

  log.debug(`Schedule content ${contentId} with schedule ${scheduleId}`);
  if (await _contentService.scheduleContent(contentId, scheduleId)) {
    return 'ok';
  }
  return 'ko';
};
