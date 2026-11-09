let PartnerService = require('../../../../services/PartnerService');
const log = require('../../../../util/log').getLogger('Partner/delete');

let _partnerService = null;
module.exports = async (_parent, { id }) => {
  if (!_partnerService) {
    _partnerService = new PartnerService();
  }
  log.debug(`Get ${id}`);
  if (await _partnerService.deleteWithId(id)) {
    return 'ok';
  } else {
    return 'ko';
  }
};
