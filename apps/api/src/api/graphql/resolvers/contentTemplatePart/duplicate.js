let ContentTemplatePartService = require('../../../../services/ContentTemplatePartService');
const log = require('../../../../util/log').getLogger('ContentTemplatePart/duplicate');

let _contentTemplatePartService = null;
module.exports = async (parent, { id, name }, context, info) => {
  if (!_contentTemplatePartService) {
    _contentTemplatePartService = new ContentTemplatePartService();
  }

  log.debug(`Duplicate ${id} with name ${name}`);
  return await _contentTemplatePartService.duplicate(id, name);
};
