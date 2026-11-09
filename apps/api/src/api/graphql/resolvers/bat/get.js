let BatService = require('../../../../services/BatService');
const log = require('../../../../util/log').getLogger('Bat/get');

let _batService = null;
module.exports = async (parent, { id }, context, info) => {
  if (!_batService) {
    _batService = new BatService();
  }

  log.debug(`Get ${id}`);

  return await _batService.findWithId(id);
};
