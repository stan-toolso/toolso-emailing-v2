const log = require('../../../util/log').getLogger('contactSource');

let _sourceService = null;
module.exports = async (_parent, { id }, _context, info) => {
  if (!_sourceService) {
    let SourceService = require('../../../services/SourceService');
    _sourceService = new SourceService();
  }

  log.debug(`Get source ${id}`);

  return await _sourceService.findWithId(id);
};
