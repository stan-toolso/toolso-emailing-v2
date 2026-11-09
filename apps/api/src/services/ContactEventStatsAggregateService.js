const log = require('../util/log').getLogger('ContactEventStatsService');
const { PromisePool } = require('@supercharge/promise-pool');
const mustache = require('mustache');
const { v4: uuidv4 } = require('uuid');

const PartnerService = require('./PartnerService');
const sequelize = require('../storage/sequelize');
const EventStats = require('../storage/models/EventStats');
const Sequelize = require('sequelize');
const { appendStats } = require('./utils/StatsUtils');
const { Op, QueryTypes } = Sequelize;

module.exports = class {
  constructor() {
    this.ContactEventStatsAggregate = sequelize.get()?.models?.ContactEventStatsAggregate;
    this.ContentVersion = sequelize.get()?.models?.ContentVersion;
    this.ContentTemplate = sequelize.get().models?.ContentTemplate;
    this.MailRouter = sequelize.get()?.models?.MailRouter;
    this.Sender = sequelize.get()?.models?.Sender;
    this.Content = sequelize.get()?.models?.Content;
    this.IpAddress = sequelize.get()?.models?.IpAddress;
    this.partnerService = new PartnerService();
    mustache.templateCache = undefined;
  }

  async updateAggregates(contactEventStatsList) {
    let updateObjects = {};

    for (let item of contactEventStatsList) {
      await this._updateAggregate(updateObjects, item);
    }

    log.debug(`Got ${Object.keys(updateObjects).length} objects to update`);

    await PromisePool.withConcurrency(10)
      .for(Object.keys(updateObjects))
      .process(async (UID) => {
        let updateObject = updateObjects[UID];
        let update = {};
        for (let field in updateObject.diffs) {
          update[field] = Sequelize.literal(`${field} + ${updateObject.diffs[field]}`);
        }
        let updateResult = await this.ContactEventStatsAggregate.update(update, { where: updateObject.where });
        if (!updateResult || !updateResult[0]) {
          //first aggregate, we create it.
          await this.ContactEventStatsAggregate.create({
            ...updateObject.aggregate,
            ...updateObject.where,
            ...updateObject.stats
          });
        }
      });

    log.debug(`All ${Object.keys(updateObjects).length} objects have been updated`);
  }

  async _updateAggregate(updateObjects, contactEventStats) {
    let lastAggregateStats = contactEventStats.lastAggregateStats ? JSON.parse(JSON.stringify(contactEventStats.lastAggregateStats)) : {};
    let aggregatedStats = {};

    const diffs = {};
    Object.values(EventStats).forEach((field) => {
      if (contactEventStats[field]) {
        if (!(field in lastAggregateStats) || lastAggregateStats[field] < contactEventStats[field]) {
          let diff = contactEventStats[field] - (field in lastAggregateStats ? lastAggregateStats[field] : 0);
          diffs[field] = diff;
        }
        aggregatedStats[field] = contactEventStats[field];
      }
    });
    if (contactEventStats.contentId) {
      let content = await contactEventStats.getContent();
      content.hasToUpdateDelivStats = true;
      await content.save();
    }
    contactEventStats.lastAggregateStats = aggregatedStats;
    if (Object.keys(diffs).length > 0) {
      let aggregates = _getAggregatesOfObject(contactEventStats);
      for (let aggregate of aggregates) {
        let where = {
          date: contactEventStats.date,
          aggregateType: aggregate.aggregateType,
          aggregateUid: aggregate.aggregateUid
        };
        let UID = contactEventStats.date + '_' + aggregate.aggregateType + '_' + aggregate.aggregateUid;
        if (!(UID in updateObjects)) {
          updateObjects[UID] = {
            diffs,
            where: where,
            aggregate,
            stats: JSON.parse(JSON.stringify(aggregatedStats))
          };
        } else {
          updateObjects[UID].diffs = appendStats(JSON.parse(JSON.stringify(updateObjects[UID].diffs)), diffs);
          updateObjects[UID].stats = appendStats(JSON.parse(JSON.stringify(updateObjects[UID].stats)), aggregatedStats);
        }
      }
    }
  }

  getDimensionFilter(dimension, filter) {
    let dimensionEnableMultiFilter = dimension === 'objectSender';
    if (dimensionEnableMultiFilter && filter.includes(',')) {
      let ids = filter.split(',');
      return { [Op.in]: ids };
    }
    return filter;
  }

  async getDimensionStats(fromDate, toDate, dimensionType, filter, dimensionFields) {
    let totalStats = {};
    let dimensionsStats = {};

    let dimensionField = dimensionType ? DIMENSIONS[dimensionType].field : null;

    let where = {
      date: {
        [Op.and]: []
      }
    };
    if (fromDate) {
      where.date[Op.and].push({ [Op.gte]: fromDate });
    }
    if (toDate) {
      where.date[Op.and].push({ [Op.lte]: toDate });
    }

    let aggregateType = [];

    for (let dimension in DIMENSIONS) {
      if (dimension === dimensionType || dimension in filter) {
        aggregateType.push(DIMENSIONS[dimension].type);
      }
      if (dimension in filter) {
        where[DIMENSIONS[dimension].field] = this.getDimensionFilter(dimension, filter[dimension]);
      }
    }
    if ('minRequest' in filter) {
      where.request = { [Op.gte]: filter.minRequest };
    }
    where.aggregateType = aggregateType.join(';');
    let eventStatsAggregates = await this.ContactEventStatsAggregate.findAll({
      attributes: [
        'id',
        'date',
        'request',
        'delivered',
        'soft_bounce',
        'hard_bounce',
        'contact_bounce',
        'content_bounce',
        'click',
        'open',
        'proxy_loaded',
        'unsub',
        'complaint',
        'unique_click',
        'unique_open',
        'unique_proxy_loaded',
        'contact_scores',
        'unique_delivered',
        'click_validation_asked',
        'click_validation_checked',
        'unique_click_accepted',
        'contentId',
        'contentVersionId',
        'esp',
        'sourceId',
        'scheduleId',
        'senderId',
        'ipAddressId'
      ],
      where,
      include: this.getInclude(dimensionType)
    });
    for (let item of eventStatsAggregates) {
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
        contact_scores: item.contact_scores,
        unique_delivered: item.unique_delivered,
        click_validation_asked: item.click_validation_asked,
        click_validation_checked: item.click_validation_checked,
        unique_click_accepted: item.unique_click_accepted
      };
      let dimensionId = dimensionField ? item[dimensionField] : '';
      if (!(dimensionId in dimensionsStats)) {
        let dimension = await this.extractDimensionFromItem(dimensionId, dimensionType, item, dimensionFields);
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

    return { totalStats, dimensionsStats: this.mergeDimensionStats(dimensionType, Object.values(dimensionsStats)) };
  }

  mergeDimensionStats(dimensionType, stats) {
    if (dimensionType === 'objectSender') {
      let result = [];
      stats.map((stat) => {
        if (stat.dimension) {
          stat.dimension.id = stat.dimension.id.toString();
          let foundStat = result.find((item) => item.dimension.object.senderName === stat.dimension.object.senderName && item.dimension.object.subject === stat.dimension.object.subject);
          if (foundStat) {
            foundStat.dimension.id += `,${stat.dimension.id}`;
            appendStats(foundStat.totalStats, stat.totalStats);
            stat.byDayStats.map((newDailyStat) => {
              if (!foundStat._byDayStats[newDailyStat.day]) {
                foundStat._byDayStats[newDailyStat.day] = {};
              }
              appendStats(foundStat._byDayStats[newDailyStat.day], newDailyStat.stats);
              foundStat.byDayStats = Object.values(foundStat._byDayStats);
            });
          } else {
            result.push(stat);
          }
        }
      });
      return Object.values(result);
    }
    return stats;
  }

  getInclude(dimensionType) {
    let include = undefined;
    switch (dimensionType) {
      case 'objectSender':
        include = [
          {
            model: this.ContentVersion,
            as: 'contentVersion',
            attributes: { exclude: ['html'] },
            include: [
              {
                model: this.ContentTemplate,
                as: 'contentTemplate',
                attributes: { exclude: ['html'] }
              },
              {
                model: this.Content,
                as: 'content'
              }
            ]
          }
        ];
        break;
      case 'contentVersion':
        include = [
          {
            model: this.ContentVersion,
            as: 'contentVersion'
          }
        ];
        break;
      case 'content':
        include = [
          {
            model: this.Content,
            as: 'content'
          }
        ];
        break;
      case 'ip':
        include = [
          {
            model: this.IpAddress,
            as: 'ipAddress'
          }
        ];
        break;
      case 'sender':
        include = [
          {
            model: this.Sender,
            as: 'sender',
            include: [
              {
                model: this.MailRouter,
                as: 'mailRouter'
              }
            ]
          }
        ];
        break;
    }

    return include;
  }

  getSubject(item) {
    let template = item?.contentVersion?.contentTemplate;
    let variables = {
      template_part: {},
      uuid: uuidv4(),
      content: item?.contentVersion?.templateVariables,
      contact: {}
    };

    ['id', 'email', 'firstname', 'lastname', 'zipcode', 'gender', 'dob', 'dbo', 'street', 'city', 'phone', 'md5', 'sha1', 'sha256', 'customFields', 'source'].forEach((field) => {
      variables.contact[field] = `{{contact.${field}}}`;
    });

    ['genderFormat', 'now', 'dobFormat'].forEach((field) => {
      variables[field] = function () {
        return (text) => `{{#${field}}}${text}{{/${field}}}`;
      };
    });

    let result = mustache.render(template && template.subject ? template.subject : item?.contentVersion.subject ? item?.contentVersion.subject : '', variables);
    return result;
  }

  getSender(item) {
    let template = item?.contentVersion?.contentTemplate;
    let variables = {
      template_part: {},
      uuid: uuidv4(),
      content: item?.contentVersion?.templateVariables
    };
    let result = mustache.render(template && template.senderName ? template.senderName : item?.contentVersion.senderName ? item?.contentVersion.senderName : '', variables);
    return result;
  }

  async extractDimensionFromItem(dimensionId, dimensionType, item, dimensionFields) {
    if (dimensionId) {
      let label = dimensionId;
      let object = null;

      switch (dimensionType) {
        case 'sender': {
          let sender = item.sender;
          label = `${sender.name} - ${sender.email} - ${sender.mailRouter ? sender.mailRouter.type : ''}`;
          break;
        }
        case 'content': {
          let content = item.content;
          let partner = content.partnerId ? await this.partnerService.findWithIdFromCache(content.partnerId) : null;
          label = `#${content.id} - ${partner ? `[${partner.name}] ` : ''}${content.name}`;
          object = {};
          if (!dimensionFields || dimensionFields.includes('id')) {
            object.id = content.id;
          }
          if (!dimensionFields || dimensionFields.includes('name')) {
            object.name = `${partner ? `[${partner.name}] ` : ''}${content.name}`;
          }
          if (!dimensionFields || dimensionFields.includes('isActive')) {
            object.isActive = content.isActive;
          }
          if (!dimensionFields || dimensionFields.includes('type')) {
            object.type = content.type;
          }
          if (!dimensionFields || dimensionFields.includes('partnerId')) {
            object.partnerId = content.partnerId;
          }
          if (!dimensionFields || dimensionFields.includes('partnerName')) {
            object.partnerName = partner ? partner.name : null;
          }
          if (!dimensionFields || dimensionFields.includes('incomesStats')) {
            object.incomesStats = content.incomesStats;
          }
          if (!dimensionFields || dimensionFields.includes('suspended')) {
            object.suspended = content.suspended;
          }
          if (dimensionFields && dimensionFields.includes('startDate')) {
            object.startDate = content.startDate;
          }

          break;
        }
        case 'contentVersion': {
          let contentVersion = item.contentVersion;
          label = `#${contentVersion.id} - ${contentVersion.name}`;
          break;
        }
        case 'ip': {
          let ip = item.ipAddress;
          label = `${ip.domain} - ${ip.ip}`;
          break;
        }

        case 'objectSender': {
          object = {
            subject: this.getSubject(item),
            senderName: this.getSender(item),
            contentId: item.contentVersion.contentId,
            type: item.contentVersion.content.type,
            isActive: item.contentVersion.content.isActive
          };
          label = `${object.subject} / ${object.senderName}`;
          break;
        }

        default:
          if (DIMENSIONS[dimensionType].objectMethod) {
            label = (await item[DIMENSIONS[dimensionType].objectMethod]())[DIMENSIONS[dimensionType].labelField];
          }
          break;
      }

      return {
        id: dimensionId,
        type: dimensionType,
        label,
        object
      };
    } else {
      return null;
    }
  }

  async getDelivRoutersStats(fromDate, toDate) {
    if (!fromDate || !toDate) {
      return [];
    }

    const resultFromSql = await sequelize.get().query(
      `select "Content"."type","MailRouter"."type" as router,sum("ContactEventStatsAggregate".request) as request  from "ContactEventStatsAggregate" inner join "Content" on "ContactEventStatsAggregate"."contentId"="Content"."id"
      inner join "Sender" on "Sender"."id"="ContactEventStatsAggregate"."senderId"
      inner join "MailRouter" on "MailRouter"."id"="Sender"."mailRouterId"
    where 
      "ContactEventStatsAggregate"."date">='${fromDate}' 
      and "aggregateType"='c;se'
      and "ContactEventStatsAggregate"."date"<='${toDate}' 
    group by "Content"."type","MailRouter"."type"
    order by router desc,request desc`,
      {
        type: QueryTypes.SELECT
      }
    );
    return resultFromSql;
  }
};

const _FIELDS = {
  c: 'contentId',
  cv: 'contentVersionId',
  e: 'esp',
  so: 'sourceId',
  sc: 'scheduleId',
  se: 'senderId',
  i: 'ipAddressId'
};

const DIMENSIONS = {
  content: {
    type: 'c',
    field: 'contentId',
    objectMethod: 'getContent',
    labelField: 'name'
  },
  contentVersion: {
    type: 'cv',
    field: 'contentVersionId',
    objectMethod: 'getContentVersion',
    labelField: 'name'
  },
  objectSender: {
    type: 'cv',
    field: 'contentVersionId',
    objectMethod: 'getContentVersion',
    labelField: 'name'
  },
  esp: {
    type: 'e',
    field: 'esp'
  },
  source: {
    type: 'so',
    field: 'sourceId',
    objectMethod: 'getSource',
    labelField: 'name'
  },
  schedule: {
    type: 'sc',
    field: 'scheduleId',
    objectMethod: 'getSchedule',
    labelField: 'name'
  },
  sender: {
    type: 'se',
    field: 'senderId',
    objectMethod: 'getSender',
    labelField: 'email'
  },
  ip: {
    type: 'i',
    field: 'ipAddressId',
    objectMethod: 'getIpAddress',
    labelField: 'name'
  }
};

const MAX_ASSOCIATION_SIZE = 2;

const _getAggregatesOfObject = (obj) => {
  let fields = Object.keys(_FIELDS).filter((field) => {
    return _FIELDS[field] in obj;
  });
  let aggregates = {
    '': {
      aggregateUid: '',
      aggregateType: ''
    }
  };
  for (let count = 1; count <= MAX_ASSOCIATION_SIZE; count++) {
    let associations = _getAllAssociationsOfSize(fields, count);
    for (let association of associations) {
      let aggregateUid = [];
      let aggregateType = [];
      let aggregate = {};
      for (let field of association) {
        aggregateType.push(field);
        aggregateUid.push(obj[_FIELDS[field]] ? obj[_FIELDS[field]] : null);
        aggregate[_FIELDS[field]] = obj[_FIELDS[field]];
      }
      aggregate.aggregateUid = aggregateUid.join(';');
      aggregate.aggregateType = aggregateType.join(';');
      aggregates[aggregate.aggregateType] = aggregate;
    }
  }
  return Object.values(aggregates);
};

function _getAllAssociationsOfSize(fields, size) {
  let associations = [];
  if (fields.length <= 0 || size <= 0) {
    return associations;
  }
  for (let i = 0; i <= fields.length - size; i++) {
    if (size > 1) {
      let childAssociations = _getAllAssociationsOfSize(fields.slice(i + 1), size - 1);
      for (let child of childAssociations) {
        associations.push([fields[i], ...child]);
      }
    } else {
      associations.push([fields[i]]);
    }
  }
  return associations;
}
