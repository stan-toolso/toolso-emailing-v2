let InscriptionService = require('../../../services/InscriptionService');
const log = require('../../../util/log').getLogger('contactInscriptions');

let _inscriptionService = null;
module.exports = async (parent, { limit, offset, filter }, context, info) => {
  if (!_inscriptionService) {
    _inscriptionService = new InscriptionService();
  }

  log.debug(`Get Contact inscriptions`);
  let filterToApply = !filter ? {} : { ...filter };
  if (parent && parent.id && parent.constructor.name == 'Contact') {
    filterToApply.contactId = parent.id;
  }

  return {
    limit,
    offset,
    filter: filterToApply,
    total: await _inscriptionService.countAll(filterToApply),
    contactInscriptions: await _inscriptionService.findAll(offset, limit, filterToApply)
  };
};
