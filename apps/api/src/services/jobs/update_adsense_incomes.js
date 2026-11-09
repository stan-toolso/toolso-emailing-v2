const log = require('../../util/log').getLogger('Job/update_adsense_incomes');
const moment = require('moment-timezone');

module.exports = async (day = moment().add(-1, 'days')) => {
  log.info(`update_adsense_incomes for ${day.format('YYYY-MM-DD')}`);
  const ContentIncomeService = require('../ContentIncomeService');
  const ContentService = require('../ContentService');
  const { getMainGAService } = require('../GAnalyticsService');

  let contentService = new ContentService();
  let contentIncomeService = new ContentIncomeService();
  let gaService = await getMainGAService();
  if (gaService) {
    let adsenseRevenues = await gaService.getAdsenseRevenuePerUtmContent(day, day);
    for (let item of adsenseRevenues) {
      let contentId = item.dimensionValues[0].value;
      if (contentId && parseInt(contentId)) {
        let content = await contentService.findWithId(parseInt(contentId));
        if (content) {
          let adsenseRevenue = parseFloat(item.metricValues[0].value);
          await contentIncomeService.newContentIncomes(content.id, 'unique_click', day.format('YYYY-MM-DD'), day.format('YYYY-MM-DD'), adsenseRevenue, 100);
        }
      }
    }
  }
  log.info(`update_adsense_incomes for ${day.format('YYYY-MM-DD')} done`);
};
