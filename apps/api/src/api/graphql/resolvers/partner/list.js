let PartnerService = require('../../../../services/PartnerService');
const log = require('../../../../util/log').getLogger('Partner/list');

let _partnerService = null;
module.exports = async (parent, { limit, offset, filter }, context, info) => {
  if (!_partnerService) {
    _partnerService = new PartnerService();
  }

  log.debug(`List with filter ${JSON.stringify(filter)}`);

  return {
    offset: offset,
    limit: limit,
    filter: filter,
    total: await _partnerService.countAll(filter),
    partners: await _partnerService.findAll(offset, limit, filter)
  };
};
