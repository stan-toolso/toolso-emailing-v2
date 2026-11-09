const log = require('../../../util/log').getLogger('unblacklist');

let _blacklistedContactService = null;
module.exports = async (parent, { id }, context, info) => {
  if (!_blacklistedContactService) {
    let BlacklistedContactService = require('../../../services/BlacklistedContactService');
    _blacklistedContactService = new BlacklistedContactService();
  }

  log.debug(`UnBlacklist ${id}`);

  return await _blacklistedContactService.delete(id);
};
