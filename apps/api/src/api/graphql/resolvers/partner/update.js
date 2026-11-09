let PartnerService = require('../../../../services/PartnerService');
const log = require('../../../../util/log').getLogger('Partner/update');

let _partnerService = null;
module.exports = async (parent, { partner }, context, info) => {
  if (!_partnerService) {
    _partnerService = new PartnerService();
  }

  log.debug(`Update ${partner.id}`);
  return await _partnerService.updatePartner(partner);
};
