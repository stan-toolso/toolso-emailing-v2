const log = require('../../../util/log').getLogger('contactSources');

let _sourceService = null;
module.exports = async (_, { limit, offset, filter }) => {
  if (!_sourceService) {
    let SourceService = require('../../../services/SourceService');
    _sourceService = new SourceService();
  }

  log.debug(`Get sources `);

  return {
    limit,
    offset,
    filter,
    total: await _sourceService.countAll(filter),
    sources: await _sourceService.findAll(offset, limit, filter)
  };
};
