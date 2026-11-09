let ContentTemplatePartService = require('../../../../services/ContentTemplatePartService');
const log = require('../../../../util/log').getLogger('ContentTemplatePart/list');

let _contentTemplatePartService = null;
module.exports = async (parent, { limit, offset, filter }, context, info) => {
  if (!_contentTemplatePartService) {
    _contentTemplatePartService = new ContentTemplatePartService();
  }

  log.debug(`List`);

  return {
    offset: offset,
    limit: limit,
    filter: filter,
    total: await _contentTemplatePartService.countAll(filter),
    contentTemplateParts: await _contentTemplatePartService.findAll(offset, limit, filter)
  };
};
