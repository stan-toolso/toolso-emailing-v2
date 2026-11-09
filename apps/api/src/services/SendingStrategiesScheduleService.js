const log = require('../util/log').getLogger('SendingStrategiesScheduleStats');

const sequelize = require('../storage/sequelize');
const Sequelize = require('sequelize');
const { QueryTypes } = Sequelize;
const ScheduleService = require('./ScheduleService');
const moment = require('moment-timezone');
const { getCachedSettings } = require('./SettingsService');
const { getQualityScore } = require('./scoring/qualityScore');
const { getDefaultStrategyType, getDefaultParams } = require('./scheduleStrategies/executeStrategy');

module.exports = class {
  constructor() {
    this.SendingStrategiesScheduleStats = sequelize.get().models.SendingStrategiesScheduleStats;
    this.scheduleService = new ScheduleService();
  }

  async getSchedulesWithSendingStrategies(wantedDate) {
    var dateFrom = moment(wantedDate).startOf('day');
    var dateTo = moment(wantedDate).add(1, 'day').startOf('day');
    var sql = `select coalesce("parentId","id") as parent_id,id,"config" 
              from "Schedule" 
              where "config" ->> 'contentStrategies' is not null and "type" != 'recurrent' 
                and "scheduleDate">='${dateFrom.format('YYYY-MM-DD')}' and "scheduleDate"<='${dateTo.format('YYYY-MM-DD')}'
                and "scheduleDate"<= CURRENT_TIMESTAMP - INTERVAL '2 HOUR'
    `;
    const resultFromSql = await sequelize.get().query(sql, {
      type: QueryTypes.SELECT
    });
    return resultFromSql.filter((schedule) => schedule.config.contentStrategies && schedule.config.contentStrategies.length > 0);
  }

  async getSchedulesWithPressureStrategies(wantedDate) {
    var dateFrom = moment(wantedDate).startOf('day');
    var dateTo = moment(wantedDate).add(1, 'day').startOf('day');
    var sql = `select coalesce("parentId","id") as parent_id,id, "config" 
              from "Schedule" 
              where "config" ->> 'marketingPressureStrategies' is not null and "type" != 'recurrent' 
                and "scheduleDate">='${dateFrom.format('YYYY-MM-DD')}' and "scheduleDate"<='${dateTo.format('YYYY-MM-DD')}'
                and "scheduleDate"<= CURRENT_TIMESTAMP - INTERVAL '2 HOUR'      
    `;
    const resultFromSql = await sequelize.get().query(sql, {
      type: QueryTypes.SELECT
    });
    return resultFromSql.filter((schedule) => schedule.config.marketingPressureStrategies && schedule.config.marketingPressureStrategies.length > 0);
  }

  async saveContentSendingStrategyStat(date, scheduleId, strategy, stats, esp, isMarketingPressure) {
    if (!stats || stats.request == 0) {
      return;
    }

    let sendingStrategyScheduleStat = await this.SendingStrategiesScheduleStats.create({
      scheduleId: scheduleId,
      date: date.format('YYYY-MM-DD'),
      strategyType: strategy.type ? strategy.type : strategy.name,
      strategyName: strategy.name ? strategy.name : strategy.type,
      config: strategy.params ? strategy.params : {},
      stats: stats,
      esp: esp ?? 'ALL',
      type: isMarketingPressure ? 'MarketingPressureStrategy' : 'ContentStrategy'
    });

    await sendingStrategyScheduleStat.save();
  }

  addSegmentToStrategy(strategyResult, statsToAppend) {
    strategyResult.stats.request += parseInt(statsToAppend.request);
    strategyResult.stats.unique_open += parseInt(statsToAppend.unique_open);
    strategyResult.stats.unique_click += parseInt(statsToAppend.unique_click);
    strategyResult.stats.unsub += parseInt(statsToAppend.unsub);
    strategyResult.stats.complaint += parseInt(statsToAppend.complaint);
    strategyResult.stats.contact_scores += parseInt(statsToAppend.contact_scores);
  }

  //revoir la gestion des clés de la map
  //
  //
  getInitialStats() {
    return { request: 0, unique_open: 0, unique_click: 0, unsub: 0, complaint: 0, contact_scores: 0 };
  }

  getEspLists(delivStatsBySegmentEsp, sendingStrategies) {
    let result = [];
    if (delivStatsBySegmentEsp.some((delivStatsSegmentEsp) => delivStatsSegmentEsp.esp === 'gmail')) {
      result.push('gmail');
    }
    if (delivStatsBySegmentEsp.some((delivStatsSegmentEsp) => delivStatsSegmentEsp.esp === 'orange')) {
      result.push('orange');
    }
    if (delivStatsBySegmentEsp.some((delivStatsSegmentEsp) => delivStatsSegmentEsp.esp === 'hotmail')) {
      result.push('hotmail');
    }
    if (delivStatsBySegmentEsp.some((delivStatsSegmentEsp) => delivStatsSegmentEsp.esp !== 'hotmail' && delivStatsSegmentEsp.esp !== 'orange' && delivStatsSegmentEsp.esp !== 'gmail')) {
      result.push('other');
    }
    if (sendingStrategies.specificStrategies.every((sendingStrategy) => !sendingStrategy.esps || sendingStrategy.esps.length == 0)) {
      result.push('ALL');
    }
    return result;
  }

  getStrategyEsp(strategy, esp) {
    return { ...strategy, esp: esp };
  }

  getSegmentForFeature(delivStatsSegmentEsp, segmentName) {
    if (delivStatsSegmentEsp?.segmentByFeatures) {
      if (segmentName in delivStatsSegmentEsp.segmentByFeatures) {
        return delivStatsSegmentEsp.segmentByFeatures[segmentName];
      }
    }
    return delivStatsSegmentEsp.segment;
  }

  getDelivStatsByStrategy(delivStatsBySegmentEsp, sendingStrategies) {
    let wantedEsps = this.getEspLists(delivStatsBySegmentEsp, sendingStrategies);
    var res = new Map();
    wantedEsps.map((esp) => {
      res.set('mainStrategy_' + esp, { strategy: sendingStrategies.mainStrategy, stats: this.getInitialStats() });
      sendingStrategies.specificStrategies.map((strategy) => res.set((strategy.strategy.name ?? strategy.strategy.type) + '_' + esp, { strategy: strategy.strategy, stats: this.getInitialStats() }));
    });
    let resultKeys = Array.from(res.keys());
    delivStatsBySegmentEsp.map((delivStatsSegmentEsp) => {
      let esp = delivStatsSegmentEsp.esp;
      let aggregationEsp = 'other';
      if (esp === 'gmail' || esp === 'hotmail' || esp === 'orange') {
        aggregationEsp = esp;
      }
      let foundSpecificStratForThisSegmentEsp = false;

      for (const key of resultKeys.filter((key) => key.endsWith('_' + aggregationEsp) && !key.startsWith('mainStrategy'))) {
        let currentSpecificStrategy = res.get(key);

        let segmentName = currentSpecificStrategy.strategy?.segment?.name ?? currentSpecificStrategy.strategy?.name ?? currentSpecificStrategy.strategy?.type;
        let segmentForFeature = this.getSegmentForFeature(delivStatsSegmentEsp, segmentName);

        let segmentOkForSpecificStrat = !(
          currentSpecificStrategy.strategy?.segment?.from &&
          currentSpecificStrategy.strategy?.segment?.to &&
          (segmentForFeature < currentSpecificStrategy.strategy?.segment?.from || segmentForFeature > currentSpecificStrategy.strategy?.segment?.to)
        );

        let espOkForSpecificStrat = !currentSpecificStrategy.strategy?.esps || currentSpecificStrategy.strategy?.esps.includes(esp);

        if (segmentOkForSpecificStrat && espOkForSpecificStrat) {
          foundSpecificStratForThisSegmentEsp = true;
          this.addSegmentToStrategy(currentSpecificStrategy, delivStatsSegmentEsp);
        }
      }
      if (!foundSpecificStratForThisSegmentEsp) {
        this.addSegmentToStrategy(res.get('mainStrategy_' + aggregationEsp), delivStatsSegmentEsp);
      }

      //Gestion d'un esp ALL
      if (wantedEsps.includes('ALL')) {
        let foundSpecificStratForThisSegmentonAll = false;

        for (const key of resultKeys.filter((key) => key.endsWith('_ALL') && key !== 'mainStrategy_ALL')) {
          let currentSpecificStrategy = res.get(key);
          let segmentName = currentSpecificStrategy.strategy?.segment?.name ?? currentSpecificStrategy.strategy?.name ?? currentSpecificStrategy.strategy?.type;
          let segmentForFeature = this.getSegmentForFeature(delivStatsSegmentEsp, segmentName);
          let segmentOkForSpecificStrat = !(
            currentSpecificStrategy.strategy?.segment?.from &&
            currentSpecificStrategy.strategy?.segment?.to &&
            (segmentForFeature < currentSpecificStrategy.strategy?.segment?.from || segmentForFeature > currentSpecificStrategy.strategy?.segment?.to)
          );

          if (segmentOkForSpecificStrat) {
            foundSpecificStratForThisSegmentonAll = true;
            this.addSegmentToStrategy(currentSpecificStrategy, delivStatsSegmentEsp);
          }
        }
        if (!foundSpecificStratForThisSegmentonAll) {
          this.addSegmentToStrategy(res.get('mainStrategy_ALL'), delivStatsSegmentEsp);
        }
      }
    });
    res.forEach((resultObject) => {
      resultObject.stats.qualityScore = getQualityScore(resultObject.stats);
    });
    return res;
  }

  async getDelivStatsForScheduleBySegmentEsp(scheduleId, date) {
    if (!scheduleId || !date) {
      return [];
    }
    var dateFrom = moment(date).startOf('day');
    var dateTo = moment(date).add(1, 'day').startOf('day');

    var sql = `
select 
"Contact"."id","Contact"."segment","Contact"."esp","Contact"."segmentByFeatures",
sum("ContactContent"."activityScore") as "contact_scores",
count(1)  as "request", 
count(1) filter (where "opened"=TRUE) as "unique_open",
count(1) filter (where "clicked"=TRUE) as "unique_click",
count(1) filter (where "unsubcribed"=TRUE) as "unsub", 
count(1) filter (where "complainted"=TRUE) as "complaint"
from 
"ContactContent"
inner join "Contact" on "ContactContent"."contactId"="Contact"."id" 
where  "scheduleId"=${scheduleId}
and "ContactContent"."createdAt">='${dateFrom.format('YYYY-MM-DD')}' and "ContactContent"."createdAt"<'${dateTo.format('YYYY-MM-DD')}'
`;

    sql = sql + 'group by "Contact"."id"';

    const resultFromSql = await sequelize.get().query(sql, {
      type: QueryTypes.SELECT
    });
    return resultFromSql;
  }

  async cleanPreviousValues(date, scheduleId, isMarketingPressure) {
    let type = isMarketingPressure ? 'MarketingPressureStrategy' : 'ContentStrategy';

    var wantedDate = new Date(date.toDate().toDateString());
    await this.SendingStrategiesScheduleStats.destroy({
      where: {
        scheduleId: scheduleId,
        date: wantedDate,
        type: type
      }
    });
  }

  async SaveToDatabase(delivStatsByStrategies, date, scheduleId, isMarketingPressure = false) {
    await this.cleanPreviousValues(date, scheduleId, isMarketingPressure);
    for (const stratKey of delivStatsByStrategies.keys()) {
      let esp = stratKey.split('_')[1];
      await this.saveContentSendingStrategyStat(date, scheduleId, delivStatsByStrategies.get(stratKey).strategy, delivStatsByStrategies.get(stratKey).stats, esp, isMarketingPressure);
    }
  }

  calculateMarketingPressureStrategiesStats = async (parentId, scheduleId, date, marketingPressureStrategies) => {
    if (!parentId || !date) {
      log.error('incorrect parameters for calculateMarketingPressureStrategiesStats');
      return;
    }

    if (!marketingPressureStrategies) {
      marketingPressureStrategies = await this.scheduleService.getMarketingPressureStrategies();
    }

    var sendingStrategies = await this.getMarketingPressureContentStrategies(marketingPressureStrategies);
    if (!sendingStrategies.specificStrategies || !sendingStrategies.specificStrategies.length) {
      return;
    }
    if (sendingStrategies.specificStrategies.length == 1) {
      let defaultStrat = sendingStrategies.specificStrategies[0];
      let segmentFrom = defaultStrat?.segment?.from;
      let segmentTo = defaultStrat?.segment?.to;
      let segmentEsps = defaultStrat?.strategy?.esps;
      if (segmentFrom == 1 && segmentTo == 100 && (segmentEsps == null || segmentEsps.length == 0)) {
        return;
      }
    }

    var delivStatsBySegmentEsp = await this.getDelivStatsForScheduleBySegmentEsp(scheduleId, date);
    var delivStatsByStrategies = this.getDelivStatsByStrategy(delivStatsBySegmentEsp, sendingStrategies);

    await this.SaveToDatabase(delivStatsByStrategies, date, parentId, true);
  };

  calculateSendingStrategiesStats = async (parentId, scheduleId, date, config) => {
    if (!parentId || !date) {
      log.error('incorrect parameters for calculateSendingStrategiesStats');
      return;
    }

    if (!config) {
      let schedule = await this.scheduleService.findWithId(parentId);
      config = schedule.config;
    }

    if (!config) {
      log.error(`Config for Schedule ${parentId} not found. Service calculateSendingStrategiesStats`);
      return;
    }

    var sendingStrategies = await this.getScheduleContentStrategies(config);
    if (!sendingStrategies.specificStrategies || !sendingStrategies.specificStrategies.length) {
      return;
    }
    if (sendingStrategies.specificStrategies.length == 1) {
      let defaultStrat = sendingStrategies.specificStrategies[0];
      let segmentFrom = defaultStrat?.segment?.from;
      let segmentTo = defaultStrat?.segment?.to;
      let segmentEsps = defaultStrat?.strategy?.esps;
      if ((segmentFrom == 1 || segmentFrom == 0) && segmentTo == 100 && (segmentEsps == null || segmentEsps.length == 0)) {
        return;
      }
    }

    var delivStatsBySegmentEsp = await this.getDelivStatsForScheduleBySegmentEsp(scheduleId, date);
    var delivStatsByStrategies = this.getDelivStatsByStrategy(delivStatsBySegmentEsp, sendingStrategies);

    await this.SaveToDatabase(delivStatsByStrategies, date, parentId);
  };

  getDefaultStrategyObject() {
    return {
      type: getDefaultStrategyType(),
      params: getDefaultParams()
    };
  }

  async getMarketingPressureContentStrategies(marketingPressureStrategies) {
    var res = {
      mainStrategy: this.getDefaultStrategyObject(),
      specificStrategies: []
    };

    if (marketingPressureStrategies && marketingPressureStrategies.length > 0) {
      if (!marketingPressureStrategies[0].segment) {
        res.mainStrategy = marketingPressureStrategies[0];
      } else {
        marketingPressureStrategies.map((marketingPressureStrategy) => {
          res.specificStrategies.push({ segment: marketingPressureStrategy.segment, strategy: marketingPressureStrategy });
        });
      }
    }
    return res;
  }

  async getScheduleContentStrategies(config) {
    var res = {
      mainStrategy: this.getDefaultStrategyObject(),
      specificStrategies: []
    };

    if (config && config.contentStrategies && config.contentStrategies.length > 0) {
      if (!config.contentStrategies[0].segment) {
        res.mainStrategy = config.contentStrategies[0];
      } else {
        config.contentStrategies.map((contentStrategy) => {
          res.specificStrategies.push({ segment: contentStrategy.segment, strategy: contentStrategy });
        });
      }
    }
    return res;
  }

  async getLastComputationDate() {
    var sql = `SELECT "scheduleId",MAX("updatedAt") FROM "SendingStrategiesScheduleStats" where "createdAt">CURRENT_DATE - INTERVAL '3 day' group by "scheduleId"`;
    const resultFromSql = await sequelize.get().query(sql, {
      type: QueryTypes.SELECT
    });
    return resultFromSql;
  }

  needToComputeSchedule(scheduleId, lastComputations, toleratedFreshnessHours, timezone) {
    let result = true;
    if (lastComputations) {
      let foundDate = lastComputations.find((computation) => computation.scheduleId === scheduleId);
      if (foundDate && foundDate.max > moment.tz(timezone).add(-toleratedFreshnessHours, 'hour').toDate()) {
        result = false;
      }
    }
    return result;
  }

  async calculateAllSendingStrategiesStats(wantedDate, forceAllCalculation = true) {
    let { timezone } = await getCachedSettings(['timezone']);
    if (!wantedDate) {
      wantedDate = moment.tz(timezone).add(-2, 'day');
    }
    let wantedDateIsToday = moment.tz(timezone).diff(wantedDate, 'days') < 1;
    let toleratedFreshnessHours = wantedDateIsToday ? 2 : 8;

    let lastComputations;
    if (!forceAllCalculation) {
      lastComputations = await this.getLastComputationDate();
    }

    var schedulesWithContentStrategies = await this.getSchedulesWithSendingStrategies(wantedDate, toleratedFreshnessHours);
    for (var i = 0; i < schedulesWithContentStrategies.length; i++) {
      let needToComputeSchedule = this.needToComputeSchedule(schedulesWithContentStrategies[i].parent_id, lastComputations, toleratedFreshnessHours, timezone);
      needToComputeSchedule &&
        (await this.calculateSendingStrategiesStats(schedulesWithContentStrategies[i].parent_id, schedulesWithContentStrategies[i].id, wantedDate, schedulesWithContentStrategies[i].config));
    }

    var schedulesWithPressureStrategies = await this.getSchedulesWithPressureStrategies(wantedDate, toleratedFreshnessHours);
    for (var j = 0; j < schedulesWithPressureStrategies.length; j++) {
      let needToComputeSchedule = this.needToComputeSchedule(schedulesWithPressureStrategies[j].parent_id, lastComputations, toleratedFreshnessHours, timezone);
      needToComputeSchedule &&
        (await this.calculateMarketingPressureStrategiesStats(
          schedulesWithPressureStrategies[j].parent_id,
          schedulesWithPressureStrategies[j].id,
          wantedDate,
          schedulesWithPressureStrategies[j].config.marketingPressureStrategies
        ));
    }
  }

  async recalculateQualiscoreFromDate(minDate) {
    var existingSendingStats = await this.SendingStrategiesScheduleStats.findAll({
      where: {
        date: {
          [Sequelize.Op.gte]: minDate.toDate()
        }
      }
    });

    for await (const existingSendingStat of existingSendingStats) {
      existingSendingStat.stats.qualityScore = getQualityScore(existingSendingStat.stats);
      existingSendingStat.changed('stats', true);
      await existingSendingStat.save();
    }
  }
};
