let BatService = require('../../../../services/BatService');
const log = require('../../../../util/log').getLogger('Bat/send');

let _batService = null;
module.exports = async (parent, { batId, versionId }, context, info) => {
  if (!_batService) {
    _batService = new BatService();
  }

  log.debug(`Send bat ${batId}. Version ${versionId}`);
  return await _batService.sendBat(batId, versionId, context.token.email);
};
