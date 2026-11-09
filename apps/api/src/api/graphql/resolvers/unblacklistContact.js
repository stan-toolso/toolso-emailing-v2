const log = require('../../../util/log').getLogger('unblacklistContact');

let _blacklistedContactService = null;
module.exports = async (parent, { id, origin, reason }, context, info) => {
  if (!_blacklistedContactService) {
    let BlacklistedContactService = require('../../../services/BlacklistedContactService');
    _blacklistedContactService = new BlacklistedContactService();
  }

  log.debug(`UnBlacklist contact ${id}`);

  return await _blacklistedContactService.unblacklistContactWithId(id, origin, reason);
};
