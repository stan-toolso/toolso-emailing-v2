const log = require('../../../util/log').getLogger('contentStats');

let _contentService = null;
module.exports = async (parent) => {
  if (!_contentService) {
    let ContentService = require('../../../services/ContentService');
    _contentService = new ContentService();
  }

  if (parent && parent.id && parent.constructor.name == 'Content') {
    log.debug(`Get content Stats for content  ${parent.id}`);
    let content = await _contentService.findWithId(parent.id);
    if (content) {
      let result = await content.getExternalStats();
      if (result?.unsubcribed && !result?.unsubscribed) {
        // Correct typo error
        result.unsubscribed = result.unsubcribed;
        delete result.unsubcribed;
      }
      if (result?.ref_unsubcribed && !result?.ref_unsubscribed) {
        // Correct typo error
        result.ref_unsubscribed = result.ref_unsubcribed;
        delete result.ref_unsubcribed;
      }
      return result;
    }
  }

  return null;
};
