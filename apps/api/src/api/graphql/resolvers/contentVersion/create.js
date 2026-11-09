let ContentService = require('../../../../services/ContentService');
const log = require('../../../../util/log').getLogger('ContentVersion/create');

let _contentService = null;
module.exports = async (parent, { contentId }, context, info) => {
  if (!_contentService) {
    _contentService = new ContentService();
  }

  log.debug(`Create new content version for content ${contentId}`);
  return await _contentService.createContentVersion(contentId);
};
