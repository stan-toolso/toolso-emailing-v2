const log = require('../../../util/log').getLogger('unblacklistWithFields');

let _blacklistedContactService = null;
module.exports = async (parent, { email, md5, sha1, sha256 }, context, info) => {
  if (!_blacklistedContactService) {
    let BlacklistedContactService = require('../../../services/BlacklistedContactService');
    _blacklistedContactService = new BlacklistedContactService();
  }

  log.debug(`UnBlacklist contact with fields ${email}, ${md5}, ${sha1}, ${sha256}`);
  return null;

  //TODO: Finish this method.
  // return await _blacklistedContactService.deleteWithFields(id, origin, reason);
};
