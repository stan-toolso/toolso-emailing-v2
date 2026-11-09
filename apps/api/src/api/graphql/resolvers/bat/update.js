let BatService = require('../../../../services/BatService');
const log = require('../../../../util/log').getLogger('Bat/update');

let _batService = null;
module.exports = async (parent, { bat }, context, info) => {
  if (!_batService) {
    _batService = new BatService();
  }

  log.debug(`Update ${bat.id}`);
  return await _batService.updateBat(bat);
};
