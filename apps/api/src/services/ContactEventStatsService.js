const log = require('../util/log').getLogger('ContactEventStatsService');

const sequelize = require('../storage/sequelize');
const Sequelize = require('sequelize');
const { Op } = Sequelize;
const ContactEventStatsAggregateService = require('./ContactEventStatsAggregateService');
const { getSettings } = require('./SettingsService');
const { appendStats } = require('./utils/StatsUtils');

var moment = require('moment-timezone');
const { PromisePool } = require('@supercharge/promise-pool');
const EventStats = require('../storage/models/EventStats');

module.exports = class {
  constructor() {
    this.sequelizeObject = sequelize.get();
    this.ContactEventStats = this.sequelizeObject?.models?.ContactEventStats;
    this.ContactEvent = this.sequelizeObject?.models?.ContactEvent;
    this.contactEventStatsAggregateService = new ContactEventStatsAggregateService();
  }

  _getTimezone = async () => {
    if (this.timezone) {
      return this.timezone;
    }
    const { timezone } = await getSettings({ timezone: 'Europe/Paris' });
    this.timezone = timezone;
    return this.timezone;
  };

  updateStatsWithEvent = async (contactEvent, contactScore, canRetry = true) => {
    log.debug(`Update stats for contact event ${contactEvent.id}`);

    let requestDate = moment(contactEvent.requestDate).tz(await this._getTimezone());
    let date = requestDate.format('YYYY-MM-DD');

    const uid = `${contactEvent.esp},${contactEvent.ipAddressId ? contactEvent.ipAddressId : ''},${contactEvent.senderId ? contactEvent.senderId : ''},${
      contactEvent.sourceId ? contactEvent.sourceId : ''
    },${contactEvent.contentId ? contactEvent.contentId : ''},${contactEvent.contentVersionId ? contactEvent.contentVersionId : ''},${contactEvent.scheduleId ? contactEvent.scheduleId : ''}`;

    const update = {
      hasToAggregage: true
    };

    update[contactEvent.type] = Sequelize.literal(`${contactEvent.type} + 1`);
    if (contactEvent.type === EventStats.request) {
      update['contact_scores'] = Sequelize.literal(`contact_scores + ${contactScore}`);
    }

    if (contactEvent.isUnique) {
      if (contactEvent.type === 'click_validation_checked') {
        update['unique_click_accepted'] = Sequelize.literal(`unique_click_accepted + 1`);
      } else {
        update['unique_' + contactEvent.type] = Sequelize.literal(`unique_${contactEvent.type} + 1`);
        if (contactEvent.type === 'click' && contactEvent.unique_click_accepted) {
          update['unique_click_accepted'] = Sequelize.literal(`unique_click_accepted + 1`);
        }
      }
    }
    let updateResult = await this.ContactEventStats.update(update, {
      where: {
        date,
        uid: uid
      }
    });
    if (!updateResult || !updateResult[0]) {
      //we have to create the row
      let contactEventStats = this.ContactEventStats.build({
        date,
        uid,
        hasToAggregage: true,
        lastAggregateStats: {},
        esp: contactEvent.esp,
        scheduleId: contactEvent.scheduleId,
        sourceId: contactEvent.sourceId,
        senderId: contactEvent.senderId,
        ipAddressId: contactEvent.ipAddressId,
        contentId: contactEvent.contentId,
        contentVersionId: contactEvent.contentVersionId
      });
      if (contactEvent.type === EventStats.request) {
        contactEventStats['contact_scores'] = contactScore;
      }

      contactEventStats[contactEvent.type] = 1;
      if (contactEvent.isUnique) {
        if (contactEvent.type === 'click_validation_checked') {
          contactEventStats['unique_click_accepted'] = 1;
        } else {
          contactEventStats['unique_' + contactEvent.type] = 1;
        }
      }
      try {
        await contactEventStats.save();
      } catch (ex) {
        if (canRetry) {
          this.updateStatsWithEvent(contactEvent, contactScore, false);
          return;
        } else {
          log.error(`Failed to update event stats with event ${JSON.stringify(contactEvent)}`, ex);
        }
      }
    }
  };

  async getDimensionStats(fromDate, toDate, dimensionType, filter, dimensionFields) {
    if ((Object.keys(filter).length <= 2 && !dimensionType) || Object.keys(filter).length <= 1) {
      return await this.contactEventStatsAggregateService.getDimensionStats(fromDate, toDate, dimensionType, filter, dimensionFields);
    }
    let totalStats = {};
    let dimensionsStats = {};

    let dimensionField = dimensionType ? DIMENSIONS[dimensionType].field : null;

    let where = {
      date: {
        [Op.gte]: fromDate,
        [Op.lte]: toDate
      }
    };
    if (filter) {
      for (let key in filter) {
        if (key in DIMENSIONS) {
          where[DIMENSIONS[key].field] = filter[key];
        }
      }
    }

    let eventStats = await this.ContactEventStats.findAll({
      where,
      include: this.contactEventStatsAggregateService.getInclude(dimensionType)
    });
    for (let item of eventStats) {
      let stats = {
        request: item.request,
        delivered: item.delivered,
        soft_bounce: item.soft_bounce,
        hard_bounce: item.hard_bounce,
        contact_bounce: item.contact_bounce,
        content_bounce: item.content_bounce,
        click: item.click,
        open: item.open,
        proxy_loaded: item.proxy_loaded,
        unsub: item.unsub,
        complaint: item.complaint,
        unique_click: item.unique_click,
        unique_open: item.unique_open,
        unique_proxy_loaded: item.unique_proxy_loaded,
        unique_delivered: item.unique_delivered,
        click_validation_asked: item.click_validation_asked,
        click_validation_checked: item.click_validation_checked,
        unique_click_accepted: item.unique_click_accepted,
        contact_scores: item.contact_scores
      };
      let dimensionId = dimensionField ? item[dimensionField] : '';
      if (!(dimensionId in dimensionsStats)) {
        let dimension = await this.contactEventStatsAggregateService.extractDimensionFromItem(dimensionId, dimensionType, item, dimensionFields);

        dimensionsStats[dimensionId] = {
          dimension,
          totalStats: {},
          byDayStats: [],
          _byDayStats: {}
        };
      }
      if (!(item.date in dimensionsStats[dimensionId]._byDayStats)) {
        dimensionsStats[dimensionId]._byDayStats[item.date] = {
          day: item.date,
          stats: {}
        };
      }

      appendStats(totalStats, stats);
      appendStats(dimensionsStats[dimensionId].totalStats, stats);
      appendStats(dimensionsStats[dimensionId]._byDayStats[item.date].stats, stats);
      dimensionsStats[dimensionId].byDayStats = Object.values(dimensionsStats[dimensionId]._byDayStats);
    }

    return { totalStats, dimensionsStats: this.contactEventStatsAggregateService.mergeDimensionStats(dimensionType, Object.values(dimensionsStats)) };
  }

  async getStatsToAggregate(limit = 1) {
    const stats = await this.sequelizeObject.query(
      `UPDATE "ContactEventStats"  
                SET "lastAggregateDate"=:now 
                WHERE "id" in (
                    SELECT "id" from "ContactEventStats" WHERE 
                        ("lastAggregateDate" IS NULL OR "lastAggregateDate"< :maxQueuedDate) AND
                        ("hasToAggregage" IS NULL OR "hasToAggregage" IS TRUE)
                        LIMIT :limit
                        FOR UPDATE 
                )
                RETURNING * `,
      {
        replacements: {
          limit,
          now: moment().toDate(),
          maxQueuedDate: moment().add(5, 'minutes').toDate()
        },
        model: this.ContactEventStats,
        type: Sequelize.QueryTypes.SELECT
      }
    );
    return stats;
  }

  async aggregateAllStats(maxDuration) {
    log.debug(`Start to aggregate all stats`);
    let startTs = new Date().getTime();
    let hasElements = true;
    const batchSize = 100;
    while (hasElements) {
      let stats = await this.getStatsToAggregate(batchSize);
      log.debug(`Got ${stats.length} elements to aggregate`);
      await this.contactEventStatsAggregateService.updateAggregates(stats);

      log.debug(`Save  ${stats.length} elements to aggregated !`);
      await PromisePool.withConcurrency(10)
        .for(stats)
        .process(async (item) => {
          item.hasToAggregage = false;
          await item.save();
        });

      hasElements = stats.length == batchSize && new Date().getTime() - startTs <= maxDuration;
    }

    log.debug(`End of aggregate all stats`);
  }
};

const DIMENSIONS = {
  ip: {
    field: 'ipAddressId',
    objectMethod: 'getIpAddress',
    labelField: 'name'
  },
  content: {
    field: 'contentId',
    objectMethod: 'getContent',
    labelField: 'name'
  },
  sender: {
    field: 'senderId',
    objectMethod: 'getSender',
    labelField: 'email'
  },
  source: {
    field: 'sourceId',
    objectMethod: 'getSource',
    labelField: 'name'
  },
  esp: {
    field: 'esp'
  },
  contentVersion: {
    field: 'contentVersionId',
    objectMethod: 'getContentVersion',
    labelField: 'name'
  },
  schedule: {
    field: 'scheduleId',
    objectMethod: 'getSchedule',
    labelField: 'name'
  },
  objectSender: {
    field: 'contentVersionId',
    objectMethod: 'getContentVersion',
    labelField: 'objectSender'
  }
};
