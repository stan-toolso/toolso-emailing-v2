const log = require('../util/log').getLogger('InscriptionStatsService');
const moment = require('moment-timezone');
const sequelize = require('../storage/sequelize');
const { Op } = require('sequelize');
const { getSettings } = require('./SettingsService');
const ContactStatus = require('../storage/models/ContactStatus');

const { PromisePool } = require('@supercharge/promise-pool');
const { appendStats } = require('./utils/StatsUtils');

module.exports = class {
  constructor() {
    this.Contact = sequelize.get().models.Contact;
    this.ContactInscription = sequelize.get().models.ContactInscription;
    this.ContactSource = sequelize.get().models.ContactSource;
    this.InscriptionStats = sequelize.get().models.InscriptionStats;
  }

  _getTimezone = async () => {
    if (this.timezone) {
      return this.timezone;
    }
    const { timezone } = await getSettings({ timezone: 'Europe/Paris' });
    this.timezone = timezone;
    return this.timezone;
  };

  updateInscriptionStats = async (minInscriptionDate) => {
    let date = moment()
      .tz(await this._getTimezone())
      .format('YYYY-MM-DD');
    log.info(`Start inscription stats update today ${date}`);

    let inscriptionsStats = {};
    let subSourceMapping = {};
    let offset = 0;
    let hasInscription = true;
    while (hasInscription) {
      let where = minInscriptionDate
        ? {
            inscriptionDate: {
              [Op.gte]: minInscriptionDate.startOf('day').toDate()
            }
          }
        : null;
      let inscriptions = await this.ContactInscription.findAll({
        where,
        offset: offset,
        limit: 1000,
        include: [
          { model: this.Contact, as: 'contact' },
          { model: this.ContactSource, as: 'source' }
        ],
        order: [['inscriptionDate', 'ASC']]
      });
      let initalEventStats = {
        request: 0,
        unique_open: 0,
        unique_click: 0,
        unsub: 0,
        complaint: 0,
        proxy_loaded: 0
      };
      log.debug(`Got ${inscriptions.length} inscriptions`);
      for (let inscription of inscriptions) {
        let contact = inscription.contact;
        let inscriptionDate = moment(inscription.inscriptionDate)
          .tz(await this._getTimezone())
          .format('YYYY-MM-DD');
        if (!(inscriptionDate in inscriptionsStats)) {
          inscriptionsStats[inscriptionDate] = {
            count: 0,
            news: 0,
            actives: 0,
            newActives: 0,

            uniqueCount: 0,
            uniqueNews: 0,
            uniqueActives: 0,
            uniqueNewActives: 0,
            eventStats: {
              ...initalEventStats
            },

            inscriptionByEsps: {},
            inscriptionBySources: {},
            inscriptionByStatus: {},
            inscriptionByActivityScores: {}
          };
        }
        let statsObject = inscriptionsStats[inscriptionDate];

        let statsToAdd = {
          count: 0,
          news: 0,
          actives: 0,
          newActives: 0,

          uniqueCount: 0,
          uniqueNews: 0,
          uniqueActives: 0,
          uniqueNewActives: 0,
          eventStats: {
            ...initalEventStats
          }
        };

        statsToAdd.count++;
        if (inscription.isFirstToday) {
          statsToAdd.uniqueCount++;
        }
        if (inscription.isFirst) {
          statsToAdd.news++;
          if (inscription.isFirstToday) {
            statsToAdd.uniqueNews++;
          }
        }
        if (inscription.activated) {
          statsToAdd.actives++;
          if (inscription.isFirstToday) {
            statsToAdd.uniqueActives++;
          }
        }
        if (inscription.activated && inscription.isFirst) {
          statsToAdd.newActives++;
          if (inscription.isFirstToday) {
            statsToAdd.uniqueNewActives++;
          }
        }
        if (inscription.stats) {
          for (let key in inscription.stats) {
            if (key in statsToAdd.eventStats) {
              statsToAdd.eventStats[key] += inscription.stats[key];
            }
          }
        }

        let sourceId = inscription.source ? inscription.source.id : 0;
        let parentSourceId = inscription?.source?.parentSourceId;

        if (parentSourceId) {
          if (!(parentSourceId in subSourceMapping)) {
            subSourceMapping[parentSourceId] = [];
          }
          if (!subSourceMapping[parentSourceId].includes(sourceId)) {
            subSourceMapping[parentSourceId].push(sourceId);
          }
        }

        let sourceName = inscription.source ? inscription.source.name : 'Unknown';
        if (!(sourceId in statsObject.inscriptionBySources)) {
          statsObject.inscriptionBySources[sourceId] = {
            name: sourceName,
            count: 0,
            news: 0,
            actives: 0,
            newActives: 0,
            uniqueCount: 0,
            uniqueNews: 0,
            uniqueActives: 0,
            uniqueNewActives: 0,
            eventStats: {
              ...initalEventStats
            },
            inscriptionByEsps: {}
          };
        }

        if (parentSourceId && !(parentSourceId in statsObject.inscriptionBySources)) {
          let parentSourceName = (await inscription?.source?.getParentSource())?.name;
          statsObject.inscriptionBySources[parentSourceId] = {
            name: parentSourceName,
            count: 0,
            news: 0,
            actives: 0,
            newActives: 0,
            uniqueCount: 0,
            uniqueNews: 0,
            uniqueActives: 0,
            uniqueNewActives: 0,
            eventStats: {
              ...initalEventStats
            },
            inscriptionByEsps: {}
          };
        }

        if (contact) {
          if (!(contact.esp in statsObject.inscriptionByEsps)) {
            statsObject.inscriptionByEsps[contact.esp] = {
              name: contact.esp,
              count: 0,
              news: 0,
              actives: 0,
              newActives: 0,
              uniqueCount: 0,
              uniqueNews: 0,
              uniqueActives: 0,
              uniqueNewActives: 0,
              eventStats: {
                ...initalEventStats
              }
            };
          }

          statsObject.inscriptionByEsps[contact.esp] = appendStats(statsObject.inscriptionByEsps[contact.esp], statsToAdd);
        }

        statsObject = appendStats(statsObject, statsToAdd);
        statsObject.inscriptionBySources[sourceId] = appendStats(statsObject.inscriptionBySources[sourceId], statsToAdd);
        if (parentSourceId) {
          statsObject.inscriptionBySources[parentSourceId] = appendStats(statsObject.inscriptionBySources[parentSourceId], statsToAdd);
        }
        if (contact) {
          if (!(contact.esp in statsObject.inscriptionBySources[sourceId].inscriptionByEsps)) {
            statsObject.inscriptionBySources[sourceId].inscriptionByEsps[contact.esp] = {
              name: contact.esp,
              count: 0,
              news: 0,
              actives: 0,
              newActives: 0,
              uniqueCount: 0,
              uniqueNews: 0,
              uniqueActives: 0,
              uniqueNewActives: 0,
              eventStats: {
                ...initalEventStats
              }
            };
          }
          statsObject.inscriptionBySources[sourceId].inscriptionByEsps[contact.esp] = appendStats(statsObject.inscriptionBySources[sourceId].inscriptionByEsps[contact.esp], statsToAdd);
          if (parentSourceId) {
            if (!(contact.esp in statsObject.inscriptionBySources[parentSourceId].inscriptionByEsps)) {
              statsObject.inscriptionBySources[parentSourceId].inscriptionByEsps[contact.esp] = {
                name: contact.esp,
                count: 0,
                news: 0,
                actives: 0,
                newActives: 0,
                uniqueCount: 0,
                uniqueNews: 0,
                uniqueActives: 0,
                uniqueNewActives: 0,
                eventStats: {
                  ...initalEventStats
                }
              };
            }
            statsObject.inscriptionBySources[parentSourceId].inscriptionByEsps[contact.esp] = appendStats(statsObject.inscriptionBySources[parentSourceId].inscriptionByEsps[contact.esp], statsToAdd);
          }
        }

        if (contact) {
          if (!(contact.status in statsObject.inscriptionByStatus)) {
            statsObject.inscriptionByStatus[contact.status] = 0;
          }
          statsObject.inscriptionByStatus[contact.status]++;

          if (contact.status == ContactStatus.workable || contact.status == ContactStatus.new) {
            var activityScore = Math.round(contact.activityScore);
            if (!isNaN(activityScore)) {
              if (!(activityScore in statsObject.inscriptionByActivityScores)) {
                statsObject.inscriptionByActivityScores[activityScore] = 0;
              }
              statsObject.inscriptionByActivityScores[activityScore]++;
            }
          }
        }
      }

      if (inscriptions.length == 0) {
        hasInscription = false;
      } else {
        offset += inscriptions.length;
      }
    }

    if (Object.keys(subSourceMapping).length > 0) {
      for (let inscriptionDate in inscriptionsStats) {
        for (let parentId in subSourceMapping) {
          let subSourcesObject = {};
          for (let childId of subSourceMapping[parentId]) {
            subSourcesObject[childId] = inscriptionsStats[inscriptionDate]?.inscriptionBySources[childId];
          }
          if (inscriptionsStats[inscriptionDate]?.inscriptionBySources[parentId]) {
            inscriptionsStats[inscriptionDate].inscriptionBySources[parentId].inscriptionBySubSources = subSourcesObject;
          }
        }
      }
    }

    let items = [];
    for (let inscriptionDate in inscriptionsStats) {
      items.push({
        inscriptionDate,
        stats: inscriptionsStats[inscriptionDate]
      });
    }

    await PromisePool.withConcurrency(10)
      .for(items)
      .process(async (item) => {
        let updateResult = await this.InscriptionStats.update(
          {
            stats: item.stats
          },
          {
            where: {
              date: date,
              inscriptionDate: item.inscriptionDate
            }
          }
        );
        if (!updateResult || !updateResult[0]) {
          //we have to create the row
          await this.InscriptionStats.create({
            ...item,
            date: date
          });
        }
      });

    log.info(`Inscription stats done !`);
  };

  getLastInscriptionStats = async (fromInscriptionDate, toInscriptionDate, date) => {
    let today = moment()
      .tz(await this._getTimezone())
      .format('YYYY-MM-DD');
    if (!date) {
      date = today;
    }
    let stats = await this.InscriptionStats.findAll({
      where: {
        inscriptionDate: {
          [Op.gte]: fromInscriptionDate,
          [Op.lte]: toInscriptionDate
        }
      },
      order: [
        ['inscriptionDate', 'DESC'],
        ['date', 'DESC']
      ]
    });
    let dedupDates = {};
    stats = stats.filter((item) => {
      if (item.inscriptionDate in dedupDates) {
        return false;
      }
      dedupDates[item.inscriptionDate] = 1;
      return true;
    });

    if (!stats || (stats.length == 0 && date == today)) {
      stats = await this.getLastInscriptionStats(
        fromInscriptionDate,
        toInscriptionDate,
        moment()
          .tz(await this._getTimezone())
          .add(-1, 'days')
          .format('YYYY-MM-DD')
      );
    }
    return stats;
  };
  getInscriptionStats = async (inscriptionDate, fromDate, toDate) => {
    return await this.InscriptionStats.findAll({
      where: {
        inscriptionDate: inscriptionDate,
        date: {
          [Op.gte]: fromDate,
          [Op.lte]: toDate
        }
      },
      order: [['date', 'DESC']]
    });
  };
};
