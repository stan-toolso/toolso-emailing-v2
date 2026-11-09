let ContentTemplatePartService = require('../../../../services/ContentTemplatePartService');
const log = require('../../../../util/log').getLogger('ContentTemplatePart/get');

let _contentTemplatePartService = null;
module.exports = async (parent, { id }, context, info) => {
  if (!_contentTemplatePartService) {
    _contentTemplatePartService = new ContentTemplatePartService();
  }

  log.debug(`Get ${id}`);

  return await _contentTemplatePartService.findWithId(id);
};
