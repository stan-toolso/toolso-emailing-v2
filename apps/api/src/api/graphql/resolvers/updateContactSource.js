const log = require('../../../util/log').getLogger('update contact source');

let _sourceService = null;
module.exports = async (parent, { source }, context, info) => {
  if (!_sourceService) {
    let SourceService = require('../../../services/SourceService');
    _sourceService = new SourceService();
  }

  log.debug(`Update contact source ${source.id}`);
  return await _sourceService.update(source);
};
