let ContentTemplateService = require('../../../services/ContentTemplateService');
const log = require('../../../util/log').getLogger('update content template');

let _contentTemplateService = null;
module.exports = async (parent, { contentTemplateId, name }, context, info) => {
  if (!_contentTemplateService) {
    _contentTemplateService = new ContentTemplateService();
  }

  log.debug(`Duplicate content template ${contentTemplateId} with name ${name}`);
  return await _contentTemplateService.duplicateContentTemplate(contentTemplateId, name);
};
