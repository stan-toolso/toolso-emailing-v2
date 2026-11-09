const log = require('../../../util/log').getLogger('exclusionLists');

let _exclusionListService = null;
module.exports = async (parent, { id }, context, info) => {
  if (!_exclusionListService) {
    let ExclusionListService = require('../../../services/ExclusionListService');
    _exclusionListService = new ExclusionListService();
  }

  log.debug(`Get exclusion ${id} `);

  return await _exclusionListService.findWithId(id);
};
