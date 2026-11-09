const log = require('../../../../util/log').getLogger('Incomes/create');

let _contentIncomeService = null;
module.exports = async (parent, { contentId, fromDate, toDate, type, recordedIncome, validationRate }, context, info) => {
  if (!_contentIncomeService) {
    let ContentIncomeService = require('../../../../services/ContentIncomeService');
    _contentIncomeService = new ContentIncomeService();
  }

  log.debug(`Create content incomes for content ${contentId} from ${fromDate} to ${toDate}`);

  return await _contentIncomeService.newContentIncomes(contentId, type, fromDate, toDate, recordedIncome, validationRate);
};
