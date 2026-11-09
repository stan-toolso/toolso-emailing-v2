let ContentTemplateService = require('../../../services/ContentTemplateService');
const log = require('../../../util/log').getLogger('contentTemplates');

let _contentTemplateService = null;
module.exports = async (parent, { limit, offset, filter }, context, info) => {
  if (!_contentTemplateService) {
    _contentTemplateService = new ContentTemplateService();
  }

  log.debug(`Get content templates `);

  return {
    offset: offset,
    limit: limit,
    filter: filter,
    total: await _contentTemplateService.countAll(filter),
    contentTemplates: await _contentTemplateService.findAll(offset, limit, filter)
  };
};
