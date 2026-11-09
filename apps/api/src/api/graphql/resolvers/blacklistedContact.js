const log = require('../../../util/log').getLogger('blacklistedContact');

let _blacklistedContactService = null;
module.exports = async (parent, { id }, context, info) => {
  if (!_blacklistedContactService) {
    let BlacklistedContactService = require('../../../services/BlacklistedContactService');
    _blacklistedContactService = new BlacklistedContactService();
  }

  log.debug(`Get blacklisted contact ${id}`);

  return await _blacklistedContactService.findWithId(id);
};
