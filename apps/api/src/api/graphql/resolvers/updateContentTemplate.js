let ContentTemplateService = require('../../../services/ContentTemplateService');
const log = require('../../../util/log').getLogger('update content template');

let _contentTemplateService = null;
module.exports = async (parent, { contentTemplate }, context, info) => {
  if (!_contentTemplateService) {
    _contentTemplateService = new ContentTemplateService();
  }

  log.debug(`Update content template ${contentTemplate.id}`);
  return await _contentTemplateService.updateContentTemplate(contentTemplate);
};
