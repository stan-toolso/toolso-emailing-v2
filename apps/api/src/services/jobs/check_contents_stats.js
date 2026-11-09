let _contentService = null;

module.exports = async () => {
  if (!_contentService) {
    const ContentService = require('../ContentService');
    _contentService = new ContentService();
  }
  await _contentService.checkContentsStats();
};
