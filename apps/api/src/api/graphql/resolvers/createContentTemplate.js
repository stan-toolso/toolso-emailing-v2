let ContentTemplateService = require('../../../services/ContentTemplateService');
const log = require('../../../util/log').getLogger('createContentTemplate');

let _contentTemplateService = null;
module.exports = async (parent, { name }, context, info) => {
  if (!_contentTemplateService) {
    _contentTemplateService = new ContentTemplateService();
  }

  log.debug(`Create content template with name ${name}`);
  return await _contentTemplateService.createContentTemplate(name);
};
