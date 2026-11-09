let ContentService = require('../../../services/ContentService');
const log = require('../../../util/log').getLogger('content');

let _contentService = null;
module.exports = async (_, { input }) => {
  if (!_contentService) {
    _contentService = new ContentService();
  }

  log.debug(`Create content with name ${input.name}`);
  return await _contentService.createCompleteContent(input);
};
