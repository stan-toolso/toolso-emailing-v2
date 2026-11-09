const log = require('../../../util/log').getLogger('create contact source');

let _sourceService = null;
module.exports = async (_, { name, parentSourceId }) => {
  if (!_sourceService) {
    let SourceService = require('../../../services/SourceService');
    _sourceService = new SourceService();
  }

  log.debug(`Create contact source ${name}`);
  return await _sourceService.createWithName(name, parentSourceId);
};
