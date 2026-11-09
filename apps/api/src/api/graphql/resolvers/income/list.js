const log = require('../../../../util/log').getLogger('Incomes/list');

let _contentIncomeService = null;
module.exports = async (parent, { fromDate, toDate, filter, estimateIncomes = false }) => {
  if (!_contentIncomeService) {
    let ContentIncomeService = require('../../../../services/ContentIncomeService');
    _contentIncomeService = new ContentIncomeService();
  }

  filter = filter ?? {};

  if (parent && parent.id && parent.constructor.name == 'Content') {
    filter.contentId = parent.id;
  }
  if (fromDate) {
    filter.fromDate = fromDate;
  }
  if (toDate) {
    filter.toDate = toDate;
  }

  log.debug(`Get display incomes with filter ${JSON.stringify(filter)}, estimateIncomes=${JSON.stringify(estimateIncomes)}`);

  return await _contentIncomeService.getIncomes({ filter, estimateIncomes });
};
