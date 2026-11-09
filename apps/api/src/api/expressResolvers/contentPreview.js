let ContentService = require('../../services/ContentService');
const PreviewTextInsert = require('../../services/utils/PreviewTextInsert');
const log = require('../../util/log').getLogger('content');
var cheerio = require('cheerio');

let _contentService = null;
module.exports = async (req, res) => {
  let contentId = req.params.content_id;
  let contentVersionId = req.params.version_id;
  if (!_contentService) {
    _contentService = new ContentService();
  }
  log.debug(`Get content preview ${contentId},${contentVersionId}`);

  let content = await _contentService.findWithId(contentId);
  let contentVersion = await _contentService.findContentVersionWithId(contentId, contentVersionId);
  if (content && contentVersion) {
    let { html, previewText } = await _contentService.compileContentVersion(content, contentVersion, null, true);
    if (previewText) {
      var cheerioLoadedHtml = cheerio.load(html);
      html = PreviewTextInsert(cheerioLoadedHtml, previewText);
    }
    res.send(html);
  } else {
    res.send('No version');
  }
};
