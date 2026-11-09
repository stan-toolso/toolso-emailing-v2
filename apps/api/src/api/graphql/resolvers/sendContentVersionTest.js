let ContentSender = require('../../../services/ContentSender');
const log = require('../../../util/log').getLogger('SendContentVersionTest');

let _contentSender = null;
module.exports = async (parent, { emails, contentId, versionId, sendingConfigId }, context, info) => {
  if (!_contentSender) {
    _contentSender = new ContentSender();
  }

  return await _contentSender.sendContentVersionTest(emails, contentId, versionId, sendingConfigId);
};
