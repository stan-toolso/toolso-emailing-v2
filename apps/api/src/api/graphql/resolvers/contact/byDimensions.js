const { Actions } = require('../../Actions');
const { checkActionPermission } = require('../../permissionFilter');

const log = require('../../../../util/log').getLogger('Contact/byDimensions');

let _contactService = null;
module.exports = async (parent, { filter, dimensions, fields }, context, info) => {
  if (!_contactService) {
    let ContactService = require('../../../../services/ContactService');
    _contactService = new ContactService();
  }
  await checkActionPermission(Actions.Contacts.Stats, context);
  if (!fields) {
    fields = [];
  }
  if (!dimensions) {
    dimensions = [];
  }
  log.debug(`Get contacts by dimensions ${JSON.stringify(filter)}, ${JSON.stringify(dimensions)}, ${JSON.stringify(fields)}`);

  return {
    filter,
    dimensions,
    fields,
    result: await _contactService.byDimensions({ filter, dimensions, fields })
  };
};
