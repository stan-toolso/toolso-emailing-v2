let _sourceService = null;
module.exports = async (req, res, next) => {
  let apiKey = req.get('apikey');

  if (!apiKey && req.body && 'apikey' in req.body) {
    apiKey = req.body.apikey;
  }
  if (!apiKey && req.headers && 'apikey' in req.headers) {
    apiKey = req.headers.apikey;
  }
  if (!apiKey) {
    res.json({
      status: 'ko',
      code: 'forbidden'
    });
  } else {
    if (!_sourceService) {
      const SourceService = require('../../services/SourceService');
      _sourceService = new SourceService();
    }
    let source = await _sourceService.getSourceFromApiKey(apiKey);
    if (source) {
      req.source = source;
      next();
    } else {
      res.json({
        status: 'ko',
        code: 'forbidden'
      });
    }
  }
};
