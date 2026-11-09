let ContentService = require('../../../services/ContentService');
const log = require('../../../util/log').getLogger('content');

let _contentService = null;
module.exports = async (parent, { contentId, name, type }, context, info) => {
  if (!_contentService) {
    _contentService = new ContentService();
  }

  log.debug(`Duplicate content ${contentId} with name ${name}`);
  return await _contentService.duplicateContent(contentId, name, type);
};
