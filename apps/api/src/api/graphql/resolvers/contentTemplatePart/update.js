let ContentTemplatePartService = require('../../../../services/ContentTemplatePartService');
const log = require('../../../../util/log').getLogger('ContentTemplatePart/update');

let _contentTemplatePartService = null;
module.exports = async (parent, { contentTemplatePart }, context, info) => {
  if (!_contentTemplatePartService) {
    _contentTemplatePartService = new ContentTemplatePartService();
  }

  log.debug(`Update ${contentTemplatePart.id}`);
  return await _contentTemplatePartService.update(contentTemplatePart);
};
