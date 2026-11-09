const log = require('../../util/log').getLogger('calculate_usages');
module.exports = async (days = 2, endDays = 1) => {
  if (!require('../../util/config').usageDatabaseUrl()) {
    log.info('USAGE_DATABASE_URL not configured: usage calculation skipped');
    return;
  }
  const moment = require('moment-timezone');
  const startDate = moment().add(-1 * days, 'days');
  const endDate = moment().add(-1 * endDays, 'days');

  log.debug(`Start of usage calculation from ${startDate.format('YYYY-MM-DD')} to ${endDate.format('YYYY-MM-DD')}`);

  const UsageService = require('../usage/UsageService');
  const UsageType = require('../usage/UsageType');
  const usageService = new UsageService();
  await usageService.initConnection();
  const ContactEventStatsAggregateService = require('../ContactEventStatsAggregateService');
  const SenderService = require('../SenderService');
  const senderService = new SenderService();

  const calculateEngineUsageForDates = async (fromDate, toDate) => {
    log.debug(`[${process.env.RESOURCE_UID}] Calculate engine usage from ${fromDate} to ${toDate}`);
    let currentDate = moment(fromDate);
    while (currentDate.isSameOrBefore(toDate)) {
      await usageService.createOrUpdateUsage(currentDate, UsageType.engine_active_database, null, 1);
      currentDate.add(1, 'days');
    }

    let aggregatesStats = await new ContactEventStatsAggregateService().getDimensionStats(fromDate, toDate, null, {});
    if (aggregatesStats && aggregatesStats.dimensionsStats && aggregatesStats.dimensionsStats.length) {
      await Promise.all(
        aggregatesStats.dimensionsStats[0].byDayStats
          .filter((dateStats) => {
            return dateStats.stats && dateStats.stats.request;
          })
          .map((dateStats) => {
            return usageService.createOrUpdateUsage(dateStats.day, UsageType.engine_email_sent, null, dateStats.stats.request);
          })
      );
    }
  };
  const calculateRouteurUsageForDates = async (fromDate, toDate) => {
    log.debug(`[${process.env.RESOURCE_UID}] Calculate router usage  from ${fromDate} to ${toDate}`);
    let aggregatesStats = await new ContactEventStatsAggregateService().getDimensionStats(fromDate, toDate, 'sender', {});

    if (aggregatesStats && aggregatesStats.dimensionsStats) {
      let subtypesByDates = {};
      for (let dimensionStats of aggregatesStats.dimensionsStats) {
        if (!dimensionStats.totalStats.request || !dimensionStats.dimension) {
          continue;
        }

        let senderId = dimensionStats.dimension.id;
        let sender = senderId ? await senderService.findWithId(senderId) : null;
        if (sender) {
          let mailRouter = await sender.getMailRouter();
          if (mailRouter) {
            for (let dayStats of dimensionStats.byDayStats) {
              if (!(dayStats.day in subtypesByDates)) {
                subtypesByDates[dayStats.day] = {};
              }
              if (!(mailRouter.type in subtypesByDates[dayStats.day])) {
                subtypesByDates[dayStats.day][mailRouter.type] = 0;
              }

              subtypesByDates[dayStats.day][mailRouter.type] += dayStats.stats.request;
            }
          }
        }
      }

      await Promise.all(
        Object.keys(subtypesByDates).map((day) => {
          return new Promise(async (resolve) => {
            let subtypes = subtypesByDates[day];
            for (let subtype in subtypes) {
              await usageService.createOrUpdateUsage(day, UsageType.router_email_sent, subtype, subtypes[subtype]);
            }
            resolve();
          });
        })
      );
    }
  };

  await calculateEngineUsageForDates(startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD'));
  await calculateRouteurUsageForDates(startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD'));

  await usageService.updateProjections();

  log.debug('End of usage calculation');
};
