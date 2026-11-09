let ContentService = require('../../../../services/ContentService');
const log = require('../../../../util/log').getLogger('ContentVersion/update');

let _contentService = null;
module.exports = async (parent, { contentVersion }, context, info) => {
  if (!_contentService) {
    _contentService = new ContentService();
  }

  log.debug(`Update ${contentVersion.id}`);
  return await _contentService.updateContentVersion(contentVersion);
};
