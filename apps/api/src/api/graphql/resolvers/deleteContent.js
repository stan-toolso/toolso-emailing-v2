let ContentService = require('../../../services/ContentService');
const log = require('../../../util/log').getLogger('content');

let _contentService = null;
module.exports = async (parent, { contentId }, context, info) => {
  if (!_contentService) {
    _contentService = new ContentService();
  }

  log.debug(`Delete content ${contentId} `);
  if (await _contentService.deleteContent(contentId)) {
    return 'ok';
  } else {
    return 'ko';
  }
};
