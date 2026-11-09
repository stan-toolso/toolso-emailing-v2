const log = require('../../../../util/log').getLogger('Incomes/get');

let _contentIncomeService = null;
module.exports = async (parent, { id }, context, info) => {
  if (!_contentIncomeService) {
    let ContentIncomeService = require('../../../../services/ContentIncomeService');
    _contentIncomeService = new ContentIncomeService();
  }

  log.debug(`Get content income ${id}`);

  return await _contentIncomeService.findWithId(id);
};
