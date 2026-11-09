const log = require('../../util/log').getLogger('ContentGet');

let _contentService = null;
module.exports = async (req, res) => {
  if (!_contentService) {
    const ContentService = require('../../services/ContentService');
    _contentService = new ContentService();
  }
  log.debug(`Get content ${req.params.content_id}`);
  let content = await _contentService.findWithId(req.params.content_id);

  res.json({
    status: content ? 'ok' : 'ko',
    content: content
  });
};
