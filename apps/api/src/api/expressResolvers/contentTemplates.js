const log = require('../../util/log').getLogger('ContentTemplates');

let _contentTemplateService = null;
module.exports = async (req, res) => {
  if (!_contentTemplateService) {
    const ContentTemplateService = require('../../services/ContentTemplateService');
    _contentTemplateService = new ContentTemplateService();
  }

  let templates = await _contentTemplateService.findAll(
    req.query.offset ? parseInt(req.query.offset) : 0,
    req.query.limit ? req.query.limit : 100,
    req.query.filters ? JSON.parse(req.query.filters) : {}
  );
  templates.sort((a, b) => {
    return (a.name ?? '').localeCompare(b.name);
  });

  res.json({
    status: templates ? 'ok' : 'ko',
    templates: templates
      ? templates.map((template) => {
          return { id: template.id, name: template.name };
        })
      : null
  });
};
