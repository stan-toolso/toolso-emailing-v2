const log = require('../../../util/log').getLogger('enableChildSource');

let _sourceService = null;
module.exports = async (_, { sourceId }) => {
  if (!_sourceService) {
    let SourceService = require('../../../services/SourceService');
    _sourceService = new SourceService();
  }

  log.debug(`enable child Source for ${sourceId}`);
  return await _sourceService.enableChildSource(sourceId);
};
