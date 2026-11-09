const log = require('../../../util/log').getLogger('blacklistContact');

let _blacklistedContactService = null;
module.exports = async (parent, { id, origin, reason }, context, info) => {
  if (!_blacklistedContactService) {
    let BlacklistedContactService = require('../../../services/BlacklistedContactService');
    _blacklistedContactService = new BlacklistedContactService();
  }

  log.debug(`Blacklist contact ${id}`);

  return await _blacklistedContactService.blacklistContactWithId(id, origin, reason);
};
