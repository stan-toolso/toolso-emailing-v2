let ContentService = require('../../../services/ContentService');
const log = require('../../../util/log').getLogger('update content');

let _contentService = null;
module.exports = async (parent, { content }, context, info) => {
  if (!_contentService) {
    _contentService = new ContentService();
  }

  log.debug(`Update content ${content.id}`);
  return await _contentService.updateContent(content, context.token.email);
};
