let BatService = require('../../../../services/BatService');
const log = require('../../../../util/log').getLogger('Bat/create');

let _batService = null;
module.exports = async (parent, { contentId }, context, info) => {
  if (!_batService) {
    _batService = new BatService();
  }

  log.debug(`Create Bat for content ${contentId} with author ${context.token.email}`);

  return await _batService.createBat(contentId, context.token.email);
};
