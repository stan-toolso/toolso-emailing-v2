const log = require('../../../util/log').getLogger('blacklistContactWithFields');

let _blacklistedContactService = null;
module.exports = async (parent, { email, md5, sha1, sha256, origin, reason }, context, info) => {
  if (!_blacklistedContactService) {
    let BlacklistedContactService = require('../../../services/BlacklistedContactService');
    _blacklistedContactService = new BlacklistedContactService();
  }

  log.debug(`Blacklist contact with fields ${email}, ${md5}, ${sha1}, ${sha256}`);

  return await _blacklistedContactService.blacklistContact(email, md5, sha1, sha256, {}, origin, reason);
};
