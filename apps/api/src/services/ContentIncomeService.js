const log = require('../util/log').getLogger('ContentIncomeService');
const sequelize = require('../storage/sequelize');
const moment = require('moment-timezone');
const { getCachedSettings } = require('./SettingsService');
const ContactEventStatsAggregateService = require('./ContactEventStatsAggregateService');

const Sequelize = require('sequelize');

const { Op } = Sequelize;

module.exports = class {
  constructor() {
    this.Content = sequelize.get()?.models?.Content;
    this.ContentIncome = sequelize.get()?.models?.ContentIncome;

    this.contactEventStatsAggregateService = new ContactEventStatsAggregateService();
  }

  findWithId = async (id) => {
    return await this.ContentIncome.findByPk(id);
  };

  findAll = async ({ filter = {}, options = {} }) => {
    let sequelizeOptions = {
      where: this._buildWhereFromFilter(filter),
      order: options.order ? options.order : [['id', 'DESC']]
    };
    if (options.includeContent) {
      sequelizeOptions.include = [
        ...(sequelizeOptions.include ? sequelizeOptions.include : []),
        {
          model: this.Content,
          as: 'content'
        }
      ];
    }

    return await this.ContentIncome.findAll(sequelizeOptions);
  };

  _buildWhereFromFilter = (filter) => {
    let where = {};
    if ('contentId' in filter) {
      where.contentId = filter.contentId;
    }
    if ('fromDate' in filter) {
      where.date = { ...(where.date ? where.date : {}), ...{ [Op.gte]: filter.fromDate } };
    }
    if ('toDate' in filter) {
      where.date = { ...(where.date ? where.date : {}), ...{ [Op.lte]: filter.toDate } };
    }
    return where;
  };

  getIncomes = async ({ filter, estimateIncomes = false }) => {
    if (!filter.contentId && (!filter.fromDate || !filter.toDate)) {
      log.warn(`A filter must be defined to get incomes`);
      return null;
    }
    let fromDate = filter.fromDate;
    let toDate = filter.toDate;
    let manualIncomes = await this.findAll({ filter });
    if (!estimateIncomes) {
      return manualIncomes;
    }
    let byContent = {};
    for (let item of manualIncomes) {
      if (!(item.contentId in byContent)) {
        byContent[item.contentId] = {
          contentId: item.contentId,
          incomes: []
        };
      }
      byContent[item.contentId].incomes.push(item);
      if (!fromDate || fromDate > item.date) {
        fromDate = item.date;
      }
      if (!toDate || toDate < item.date) {
        toDate = item.date;
      }
    }
    let { dimensionsStats } = await this.contactEventStatsAggregateService.getDimensionStats(filter.fromDate, filter.toDate, 'content', {
      ...(filter.contentId ? { contentId: filter.contentId } : {})
    });
    fromDate = moment(fromDate);
    toDate = moment(toDate);
    for (let dimensionStats of dimensionsStats) {
      let contentId = dimensionStats.dimension?.id;
      if (contentId && contentId in byContent) {
        let contentObject = byContent[contentId];
        var currentDate = moment(fromDate);

        while (currentDate <= toDate) {
          currentDate.add(1, 'days');
          let day = currentDate.format('YYYY-MM-DD');
          let existingIncome = contentObject.incomes.find((i) => {
            return i.date === day;
          });
          if (!existingIncome) {
            let dayStats = dimensionStats.byDayStats.find((i) => {
              return i.day === day;
            });
            if (dayStats && dimensionStats.dimension.object.incomesStats) {
              let incomesStats = dimensionStats.dimension.object.incomesStats;
              if (incomesStats.last) {
                let estimatedIncome = null;
                if (incomesStats && incomesStats.last) {
                  switch (incomesStats.last.type) {
                    case 'unique_click':
                      estimatedIncome = (incomesStats.last.cpc ? incomesStats.last.cpc : 0) * (dayStats.stats.unique_click ? dayStats.stats.unique_click : 0);
                      break;
                    default:
                    case 'request':
                      estimatedIncome = (incomesStats.last.eCpm ? incomesStats.last.eCpm / 1000 : 0) * (dayStats.stats.unique_click ? dayStats.stats.request : 0);
                      break;
                  }
                }
                if (estimatedIncome) {
                  contentObject.incomes.push({
                    date: day,
                    type: incomesStats.last.type,
                    manualIncomes: null,
                    estimatedIncome,
                    contentId,
                    getContent: async () => {
                      return await this.Content.findByPk(contentId);
                    }
                  });
                }
              }
            }
          }
        }
      }
    }

    let result = [];
    for (let content of Object.values(byContent)) {
      result = [...result, ...content.incomes];
    }

    return result;
  };

  newContentIncomes = async (contentId, type, fromDate, toDate, recordedIncome, validationRate) => {
    if (toDate < fromDate) {
      return null;
    }

    log.debug(`Create new incomes for content ${contentId}`);
    let content = await this.Content.findByPk(contentId);
    if (!content) {
      log.debug(`Content  ${content.id} not found`);
      return null;
    }
    let timezone = (await getCachedSettings(['timezone'])).timezone;
    fromDate = moment.tz(fromDate, 'YYYY-MM-DD', timezone).startOf('day');
    toDate = moment.tz(toDate, 'YYYY-MM-DD', timezone).endOf('day');

    const ContactEventStatsAggregateService = require('./ContactEventStatsAggregateService');
    let aggregatesStats = await new ContactEventStatsAggregateService().getDimensionStats(fromDate.toDate(), toDate.toDate(), null, {
      content: content.id
    });

    let cursor = moment(fromDate);
    let result = [];

    let daysCount = toDate.diff(fromDate, 'days') + 1;
    let totalStats = aggregatesStats.totalStats;

    let totalOfType = totalStats[type];
    while (cursor <= toDate) {
      let formatedDate = cursor.format('YYYY-MM-DD');
      let itemRecordedIncome = 0;
      let dateStats = {
        unique_click: 0,
        unique_open: 0,
        request: 0,
        conversion: 0
      };
      if (aggregatesStats.dimensionsStats && aggregatesStats.dimensionsStats.length) {
        let dayStatsItems = aggregatesStats.dimensionsStats[0].byDayStats.filter((d) => {
          return d.day === formatedDate;
        });
        if (dayStatsItems.length) {
          dateStats = dayStatsItems[0].stats;
        }
      }

      itemRecordedIncome = totalOfType ? (recordedIncome * (dateStats[type] ? dateStats[type] : 0)) / totalOfType : recordedIncome / daysCount;

      let itemEstimatedIncome = isNaN(validationRate) ? itemRecordedIncome : (itemRecordedIncome * validationRate) / 100;

      let existingOne = await this.ContentIncome.findOne({
        where: {
          date: formatedDate,
          contentId
        }
      });
      if (existingOne) {
        existingOne.type = type;
        existingOne.recordedIncome = itemRecordedIncome;
        existingOne.validationRate = validationRate;
        existingOne.estimatedIncome = itemEstimatedIncome;
        existingOne.stats = dateStats;
        existingOne.changed('stats', true);

        await existingOne.save();
      } else {
        existingOne = await this.ContentIncome.create({
          date: formatedDate,
          contentId,
          type,
          recordedIncome: itemRecordedIncome,
          validationRate: validationRate,
          estimatedIncome: itemEstimatedIncome,
          stats: dateStats
        });
      }
      result.push(existingOne);
      cursor = cursor.add(1, 'days');
    }

    const ContentService = require('./ContentService');
    await new ContentService().updateContentStats(content, true);

    return result;
  };
};
