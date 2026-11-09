let ContentService = require('../../../services/ContentService');
const log = require('../../../util/log').getLogger('content');

let _contentService = null;
module.exports = async (parent, { id }, context, info) => {
  if (!_contentService) {
    _contentService = new ContentService();
  }

  log.debug(`Get content ${id}`);

  let content = await _contentService.findWithId(id);
  return content;
};
