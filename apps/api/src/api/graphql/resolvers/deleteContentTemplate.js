let ContentTemplateService = require('../../../services/ContentTemplateService');
const log = require('../../../util/log').getLogger('deleteContentTemplate');

let _contentTemplateService = null;
module.exports = async (parent, { contentTemplateId }, context, info) => {
  if (!_contentTemplateService) {
    _contentTemplateService = new ContentTemplateService();
  }

  log.debug(`Delete content template ${contentTemplateId} `);
  if (await _contentTemplateService.deleteContentTemplate(contentTemplateId)) {
    return 'ok';
  } else {
    return 'ko';
  }
};
