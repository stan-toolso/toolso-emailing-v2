let ContentTemplatePartService = require('../../../../services/ContentTemplatePartService');
const log = require('../../../../util/log').getLogger('ContentTemplatePart/delete');

let _contentTemplatePartService = null;
module.exports = async (parent, { id }, context, info) => {
  if (!_contentTemplatePartService) {
    _contentTemplatePartService = new ContentTemplatePartService();
  }

  log.debug(`Delete ${id} `);
  if (await _contentTemplatePartService.delete(id)) {
    return 'ok';
  } else {
    return 'ko';
  }
};
