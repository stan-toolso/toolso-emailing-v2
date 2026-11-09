let ContentTemplatePartService = require('../../../../services/ContentTemplatePartService');
const log = require('../../../../util/log').getLogger('ContentTemplatePart/create');

let _contentTemplatePartService = null;
module.exports = async (parent, { name }, context, info) => {
  if (!_contentTemplatePartService) {
    _contentTemplatePartService = new ContentTemplatePartService();
  }

  log.debug(`Create content template part with name ${name}`);
  return await _contentTemplatePartService.create(name);
};
