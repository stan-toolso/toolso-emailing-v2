let ContentService = require('../../../../services/ContentService');
const log = require('../../../../util/log').getLogger('ContentVersion/delete');

let _contentService = null;
module.exports = async (parent, { contentVersionId }, context, info) => {
  if (!_contentService) {
    _contentService = new ContentService();
  }

  log.debug(`Delete ${contentVersionId}`);
  return await _contentService.deleteContentVersion(contentVersionId);
};
