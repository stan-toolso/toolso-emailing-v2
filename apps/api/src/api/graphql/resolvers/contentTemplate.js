let ContentTemplateService = require('../../../services/ContentTemplateService');
const log = require('../../../util/log').getLogger('content template');

let _contentTemplateService = null;
module.exports = async (parent, { id }, context, info) => {
  if (!_contentTemplateService) {
    _contentTemplateService = new ContentTemplateService();
  }

  log.debug(`Get content template ${id}`);

  return await _contentTemplateService.findWithId(id);
};
