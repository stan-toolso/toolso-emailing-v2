let PartnerService = require('../../../../services/PartnerService');
const log = require('../../../../util/log').getLogger('Partner/create');

let _partnerService = null;
module.exports = async (parent, { name }, context, info) => {
  if (!_partnerService) {
    _partnerService = new PartnerService();
  }

  log.debug(`Create partner with name ${name}`);
  let partner = await _partnerService.createPartner(name);
  log.debug('End');
  return partner;
};
