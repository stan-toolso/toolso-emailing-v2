let ContentService = require('../../../services/ContentService');
const log = require('../../../util/log').getLogger('content');

let _contentService = null;
module.exports = async (_parent, { name, type }) => {
  if (!_contentService) {
    _contentService = new ContentService();
  }

  log.debug(`Create content with name ${name}`);
  return await _contentService.createContent(name, type);
};
