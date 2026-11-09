let PartnerService = require('../../../../services/PartnerService');
const log = require('../../../../util/log').getLogger('Partner/get');

let _partnerService = null;
module.exports = async (parent, { id }, context, info) => {
  if (!_partnerService) {
    _partnerService = new PartnerService();
  }
  log.debug(`Get ${id}`);
  return await _partnerService.findWithId(id);
};
