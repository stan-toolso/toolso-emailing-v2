const log = require('../../../util/log').getLogger('blacklistedContact');

let _blacklistedContactService = null;
module.exports = async (parent, { email, md5, sha1, sha256 }, context, info) => {
  if (!_blacklistedContactService) {
    let BlacklistedContactService = require('../../../services/BlacklistedContactService');
    _blacklistedContactService = new BlacklistedContactService();
  }
  if (parent && parent.id && parent.constructor.name == 'ContactMessage') {
    if (parent.sendFromToolso) {
      email = parent.to;
    } else {
      email = parent.from;
    }
  }

  log.debug(`Get blacklisted contact  ${email}, ${md5}, ${sha1}, ${sha256}`);

  return await _blacklistedContactService.findWithFields(email, md5, sha1, sha256);
};
