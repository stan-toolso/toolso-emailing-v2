const log = require('../../../util/log').getLogger('contactEvent');

let _contactEventService = null;
module.exports = async (parent, { id }, context, info) => {
  if (!_contactEventService) {
    let ContactEventService = require('../../../services/ContactEventService');
    _contactEventService = new ContactEventService();
  }

  log.debug(`Get contact event ${id}`);

  return await _contactEventService.findWithId(id);
};
