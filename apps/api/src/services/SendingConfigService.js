const sequelize = require('../storage/sequelize');
const { encryptString, getCachedSettings } = require('./SettingsService');
const ContactService = require('./ContactService');
const HistoryService = require('./HistoryService');
const ActivationService = require('./ActivationService');
const { mergeFieldsInObject } = require('./utils/DatabaseUtils');
const log = require('../util/log').getLogger('SendingConfigService');
const moment = require('moment-timezone');
const Sequelize = require('sequelize');
const ScheduleType = require('../storage/models/ScheduleType');
const ContactStatus = require('../storage/models/ContactStatus');
const { default: PromisePool } = require('@supercharge/promise-pool/dist');
const { getOppositeEsps } = require('./EspService');

const cacheById = {};

module.exports = class {
  constructor() {
    this.SendingConfig = sequelize.get()?.models?.SendingConfig;
    this.ContactEvent = sequelize.get()?.models?.ContactEvent;
    this.ContactContent = sequelize.get()?.models?.ContactContent;
    this.Schedule = sequelize.get()?.models?.Schedule;
    this.Contact = sequelize.get()?.models?.Contact;

    this.contactService = new ContactService();
    this.historyService = new HistoryService();
    this.activationService = new ActivationService();
  }

  findWithId = async (id) => {
    return await this.SendingConfig.findByPk(id);
  };

  findWithIdInCache = async (id) => {
    if (!(id in cacheById)) {
      cacheById[id] = await this.findWithId(id);
    }
    return cacheById[id];
  };

  findAll = async () => {
    return await this.SendingConfig.findAll({});
  };

  createWithName = async (name) => {
    return await this.SendingConfig.create({
      name: name ? name : 'New Sending Config',
      config: {}
    });
  };

  update = async (sendingConfig, user) => {
    let storedSendingConfig = await this.SendingConfig.findByPk(sendingConfig.id);
    if (storedSendingConfig) {
      if (sendingConfig.credentials) {
        sendingConfig.credentials = await encryptString(JSON.stringify(sendingConfig.credentials));
      }
      mergeFieldsInObject(['name', 'config'], sendingConfig, storedSendingConfig);
      await storedSendingConfig.save();

      await this.historyService.createHistory(user ?? '', sendingConfig, 'sendingConfig_update', 'sendingConfig', sendingConfig.id, 2);
    }
    return storedSendingConfig;
  };

  delete = async (id) => {
    let originalSendingConfig = await this.SendingConfig.findByPk(id);
    if (originalSendingConfig) {
      return await originalSendingConfig.destroy();
    }
    return false;
  };

  updateAllConfigsScores = async () => {
    log.debug(`Update all sending config`);
    let configs = await this.findAll();
    await PromisePool.for(configs)
      .withConcurrency(5)
      .process(async (config) => {
        await this.updateConfigScores(config);
      });
  };
  updateConfigScores = async (sendingConfig) => {
    log.debug(`[${sendingConfig.id}, ${sendingConfig.name}] Start to update config score`);
    if (sendingConfig.config && sendingConfig.config.espConfigs) {
      for (let espConfig of sendingConfig.config.espConfigs) {
        for (let senderConfig of espConfig.senders) {
          if (!senderConfig.autoUpdates) {
            continue;
          }

          let { timezone } = await getCachedSettings(['timezone']);
          let fromDate = moment.tz(timezone).add(-1, 'day').startOf('day');
          let toDate = moment.tz(timezone).add(-1, 'day').endOf('day');

          let scheduleIds = (
            await this.Schedule.findAll({
              where: {
                sendingConfigId: sendingConfig.id,
                [Sequelize.Op.or]: [
                  { type: ScheduleType.recurrent },
                  { type: ScheduleType.inscription },
                  {
                    type: ScheduleType.single_send,
                    scheduleDate: {
                      [Sequelize.Op.gte]: fromDate.toDate(),
                      [Sequelize.Op.lte]: toDate.toDate()
                    }
                  }
                ]
              }
            })
          ).map((schedule) => {
            return schedule.id;
          });

          if (espConfig.esps) {
            await Promise.all(
              espConfig.esps.map((esp) => {
                return new Promise(async (resolve, reject) => {
                  if (senderConfig.autoUpdates && esp in senderConfig.autoUpdates) {
                    let autoUpdate = senderConfig.autoUpdates[esp];
                    if (autoUpdate && autoUpdate.enabled && autoUpdate.minOpenRate) {
                      let newScore = await this._getEspSendingScore(sendingConfig, senderConfig, scheduleIds, senderConfig.senderId, esp, autoUpdate);
                      if (newScore !== null) {
                        senderConfig.minScoreByEsp[esp] = newScore;
                      }
                    }
                  }
                  resolve();
                });
              })
            ).catch((err) => {
              log.error(err);
            });
          }

          if (espConfig.default && 'default' in senderConfig.autoUpdates) {
            let autoUpdate = senderConfig.autoUpdates['default'];
            if (autoUpdate && autoUpdate.enabled && autoUpdate.minOpenRate) {
              let newScore = await this._getEspSendingScore(sendingConfig, senderConfig, scheduleIds, senderConfig.senderId, 'default', autoUpdate);
              if (newScore !== null) {
                senderConfig.minScoreByEsp['default'] = newScore;
              }
            }
          }
        }
      }
      if (!sendingConfig.history) {
        sendingConfig.history = [];
      }
      sendingConfig.history.push({
        date: new Date(),
        config: sendingConfig.config
      });

      if (sendingConfig.history.length >= 50) {
        sendingConfig.history = sendingConfig.history.slice(sendingConfig.history.length - 50);
      }
      await this.historyService.createHistory('Toolso', sendingConfig, 'sendingConfig_updateConfigScore', 'sendingConfig', sendingConfig.id, 1);

      sendingConfig.changed('config', true);
      sendingConfig.changed('history', true);
      await sendingConfig.save();
    }

    log.debug(`[${sendingConfig.id}, ${sendingConfig.name}] Update config score done`);
  };

  _getEspSendingScore = async (sendingConfig, senderConfig, scheduleIds, senderId, esp, autoUpdate) => {
    let bestScoreBySchedule = {};

    await PromisePool.for(scheduleIds)
      .withConcurrency(5)
      .process(async (scheduleId) => {
        let bestScore = await this._getEspSendingScoreForSchedule(sendingConfig, senderConfig, scheduleId, senderId, esp, autoUpdate);
        if (bestScore !== null) {
          bestScoreBySchedule[scheduleId] = bestScore;
        }
      })
      .catch((err) => {
        log.error(err);
      });

    if (Object.values(bestScoreBySchedule).length === 0) {
      return null;
    }
    let bestScore = 0;
    for (let score of Object.values(bestScoreBySchedule)) {
      bestScore += score;
    }
    return Math.round((100 * bestScore) / Object.values(bestScoreBySchedule).length) / 100;
  };

  _getEspSendingScoreForSchedule = async (sendingConfig, senderConfig, scheduleId, senderId, esp, autoUpdate) => {
    let { timezone } = await getCachedSettings(['timezone']);
    let fromDate = moment.tz(timezone).add(-1, 'day').startOf('day');
    let toDate = moment.tz(timezone).add(-1, 'day').endOf('day');
    let espWhere = esp;

    if (esp === 'default') {
      let allEsps = [];
      for (let espConfig of sendingConfig.config.espConfigs) {
        for (let espItem of espConfig.esps) {
          if (espItem !== 'default') {
            allEsps.push(espItem);
          }
        }
      }
      if (!allEsps?.length) {
        espWhere = {};
      } else {
        espWhere = {
          [Sequelize.Op.in]: getOppositeEsps(allEsps)
        };
      }
    }
    let scheduleIds = await this.Schedule.findAll({
      where: {
        parentId: scheduleId,
        scheduleDate: {
          [Sequelize.Op.gte]: fromDate.toDate(),
          [Sequelize.Op.lte]: toDate.toDate()
        }
      }
    });

    let where = {
      esp: espWhere,
      senderId,
      scheduleId: {
        [Sequelize.Op.in]: scheduleIds.map((schedule) => {
          return schedule.id;
        })
      },
      createdAt: {
        [Sequelize.Op.gte]: fromDate.toDate(),
        [Sequelize.Op.lte]: toDate.toDate()
      }
    };
    if (espWhere && Object.keys(espWhere).length > 0) {
      where.esp = espWhere;
    }

    let events = await this.ContactContent.findAll({
      attributes: ['opened', 'proxy_loaded', 'scheduleId', 'activityScore', 'soft_bounced'],
      where
    });

    let requests = 0;
    let requestsBySchedule = {};
    let unique_opens = 0;
    let unique_proxy_loadeds = 0;
    let soft_bounces = 0;
    let minScore = null;
    for (let event of events) {
      requests++;
      if (event.opened) {
        unique_opens++;
      }
      if (event.soft_bounced) {
        soft_bounces++;
      }
      if (event.proxy_loaded) {
        unique_proxy_loadeds++;
      }
      if (event.activityScore && event.activityScore > 0.00001) {
        if (minScore === null || minScore > event.activityScore) {
          minScore = event.activityScore;
        }
      }

      if (!(event.scheduleId in requestsBySchedule)) {
        requestsBySchedule[event.scheduleId] = 0;
      }
      requestsBySchedule[event.scheduleId]++;
    }

    log.trace(
      `[${sendingConfig.id}, ${sendingConfig.name}] Stats for esp ${esp} & schedule ${scheduleId} senderId ${senderId}: ${requests}, ${unique_opens}, ${unique_proxy_loadeds}, ${soft_bounces}`
    );

    if (requests === 0) {
      let actualScore = senderConfig.minScoreByEsp[esp];
      let count = await this.Contact.count({
        where: {
          status: ContactStatus.workable,
          esp,
          activityScore: {
            [Sequelize.Op.gte]: actualScore
          }
        }
      });
      if (count > 10) {
        //we should have requests
        return null;
      } else {
        return await this._getBestScoreForVolume(esp, espWhere, 10, 50, 100);
      }
    }
    //let openRate = 100 * unique_opens / requests;
    let softbounceRate = (100 * soft_bounces) / requests;
    let bestVolume = requests;
    let theoricalVolume = minScore
      ? await this.Contact.count({
          where: {
            status: ContactStatus.workable,
            esp,
            activityScore: {
              [Sequelize.Op.gte]: minScore
            }
          }
        })
      : requests;
    if (softbounceRate >= 50) {
      bestVolume = requests / 10;
    } else if (softbounceRate >= 10) {
      bestVolume = requests / 2;
    } else if (requests >= 1 && requests < 20) {
      bestVolume = 20;
      if (theoricalVolume <= 20) {
        bestVolume = 20;
      } else {
        //sans doute pour des questions de filtre, on a peu de volume. On  adapte en fonction du theorique du coup
        bestVolume = theoricalVolume * 1.2;
      }
    } else {
      let estimatedUniqueOpens = unique_opens + (unique_proxy_loadeds * unique_opens) / requests;
      let volumeDiff = (estimatedUniqueOpens - (autoUpdate.minOpenRate * requests) / 100) / (autoUpdate.minOpenRate / 100);
      if (volumeDiff > 0) {
        //si on augmente le volume, on augmente maximum de 10%.
        volumeDiff = Math.min(requests * (requests > 200 ? 0.1 : 0.2), volumeDiff);
      } else if (volumeDiff < -requests * 0.3) {
        //si on baisse le volume, on baisse maximum de 30% par jour (hors règles soft bounce ci-dessus, non plafonnées) :
        //une seule mauvaise journée coupait un ESP de moitié, pour ~8 jours de remontée à +10%/jour
        //(constaté sur une base en septembre 2026 : 48 000 -> 21 000 envois/jour sur un ESP après un taux d'ouverture ponctuellement bas)
        volumeDiff = -requests * 0.3;
      }

      bestVolume = theoricalVolume + (volumeDiff / requests) * theoricalVolume;
    }

    let bestScoreMin = 0;
    let bestScoreMax = 100;
    if (minScore) {
      if (bestVolume > theoricalVolume) {
        bestScoreMax = minScore;
      } else if (bestVolume < theoricalVolume) {
        bestScoreMin = minScore;
      }
    }
    let bestScore = await this._getBestScoreForVolume(esp, espWhere, bestVolume, bestScoreMin, bestScoreMax, bestVolume > theoricalVolume);

    log.debug(`[${sendingConfig.id}, ${sendingConfig.name}] Best score esp ${esp} & schedule ${scheduleId} senderId ${senderId}: ${bestScore}`);
    return bestScore;
  };

  _getBestScoreForVolume = async (esp, espWhere, volume, minScore, maxScore, maximizeVolume, threshold = 0.01, status = ContactStatus.workable) => {
    log.trace(`Get best score for volume Esp:${esp}, Volume:${volume}, [${minScore},${maxScore}], maximizeVolume=${maximizeVolume}. Where={${espWhere}}`);
    if (maxScore - minScore <= threshold) {
      if (maximizeVolume) {
        return Math.max(0.01, minScore);
      } else {
        return maxScore;
      }
    }
    let testScore = (maxScore + minScore) / 2;

    let where = {
      status,
      activityScore: {
        [Sequelize.Op.gte]: testScore
      }
    };
    if (espWhere && Object.keys(espWhere).length > 0) {
      where.esp = espWhere;
    }

    let count = await this.Contact.count({
      where
    });
    let nextThreshold = volume > 1000 && Math.abs((volume - count) / volume) <= 0.05 ? 0.1 : 0.01;
    if (count < volume) {
      return await this._getBestScoreForVolume(esp, espWhere, volume, minScore, testScore, maximizeVolume, nextThreshold, status);
    } else {
      return await this._getBestScoreForVolume(esp, espWhere, volume, testScore, maxScore, maximizeVolume, nextThreshold, status);
    }
  };

  _getNewScoreAccordingToWorkableScore = async (esp, espWhere, workableScore) => {
    let where = {
      status: ContactStatus.workable,
      activityScore: {
        [Sequelize.Op.gte]: workableScore
      }
    };

    if (espWhere && Object.keys(espWhere).length > 0) {
      where.esp = espWhere;
    }

    let workableVolume = await this.Contact.count({
      where
    });

    let newRatio = null;
    let config = await this.activationService.getTodayConfig(esp);
    if (config && config.config && config.config.newRatioEnabled) {
      newRatio = config.config.newRatio ?? 0;
    }

    if (newRatio === null && workableScore <= 50) {
      if (workableScore <= 35) {
        newRatio = 0.05;
      } else if (workableScore <= 40) {
        newRatio = 0.04;
      } else if (workableScore <= 45) {
        newRatio = 0.03;
      } else if (workableScore <= 48) {
        newRatio = 0.02;
      } else {
        newRatio = 0.01;
      }
    }
    if (newRatio) {
      let newsVolume = Math.ceil(workableVolume * newRatio);
      if (config?.config?.scheduleCappingEnabled) {
        let capping = config.config.scheduleCapping ?? 0;
        newsVolume = Math.min(newsVolume, capping);
      }

      let newScore = await this._getBestScoreForVolume(esp, espWhere, newsVolume, 0, 50, true, 0.01, ContactStatus.new);
      return newScore;
    } else {
      return 100;
    }
  };

  countContactsInSendingConfig = async (config) => {
    log.debug(`Count contacts in config ${JSON.stringify(config)}`);

    let result = {
      total: 0,
      esps: {}
    };
    let sendingConfigFilter = await this.getFilterOfSendingConfig(
      {
        config
      },
      false
    );

    let { where } = await this.contactService._buildWhereFromFilter(sendingConfigFilter);

    let counts = await this.Contact.findAll({
      where,
      group: ['esp'],
      attributes: ['esp', [Sequelize.fn('COUNT', 'esp'), 'espCount']],
      raw: true
    });
    for (let item of counts) {
      let count = parseInt(item.espCount);
      if (!isNaN(count)) {
        result.total += count;
        result.esps[item.esp] = count;
      }
    }
    return result;
  };

  getFilterOfSendingConfig = async (sendingConfig, includeNews = true) => {
    let delivConfig = {
      type: 'or',
      children: []
    };
    if (sendingConfig && sendingConfig.config && sendingConfig.config.espConfigs) {
      let espsScores = {};
      for (let espConfig of sendingConfig.config.espConfigs) {
        if (espConfig.senders) {
          for (let sender of espConfig.senders) {
            if (!sender.minNewScoreByEsp) {
              sender.minNewScoreByEsp = {};
            }
            if (sender.minScoreByEsp) {
              for (let esp of espConfig.esps) {
                if (esp in sender.minScoreByEsp) {
                  let newScore = 100;
                  if (includeNews) {
                    //   let config = await this.activationService.getTodayConfig(esp);
                    //   if (config) {
                    //     //inutile de limiter le nombre de new, puisque on a une config d'activation que s'en occupe
                    //     newScore = sender.minScoreByEsp[esp];
                    //   } else {
                    //     newScore = esp in sender.minNewScoreByEsp ? sender.minNewScoreByEsp[esp] : await this._getNewScoreAccordingToWorkableScore(esp, esp, sender.minScoreByEsp[esp]);
                    //   }
                    newScore = esp in sender.minNewScoreByEsp ? sender.minNewScoreByEsp[esp] : await this._getNewScoreAccordingToWorkableScore(esp, esp, sender.minScoreByEsp[esp]);
                  }
                  sender.minNewScoreByEsp[esp] = newScore;

                  if (esp in espsScores) {
                    espsScores[esp] = {
                      score: Math.min(sender.minScoreByEsp[esp], espsScores[esp].score),
                      newScore: Math.min(newScore, espsScores[esp].newScore)
                    };
                  } else {
                    espsScores[esp] = {
                      score: sender.minScoreByEsp[esp],
                      newScore
                    };
                  }
                }
              }
              if (espConfig.default) {
                let allEsps = [];
                for (let espConfig of sendingConfig.config.espConfigs) {
                  for (let espItem of espConfig.esps) {
                    if (espItem !== 'default') {
                      allEsps.push(espItem);
                    }
                  }
                }
                let espWhere = {};
                if (allEsps?.length) {
                  espWhere = {
                    [Sequelize.Op.in]: getOppositeEsps(allEsps)
                  };
                }
                let esp = 'default';
                let newScore = 100;
                if (includeNews) {
                  // let config = await this.activationService.getTodayConfig(null);
                  // if (config) {
                  //   newScore = esp in sender.minNewScoreByEsp ? sender.minScoreByEsp[esp] : 100;
                  // } else {
                  //   newScore = esp in sender.minNewScoreByEsp ? sender.minNewScoreByEsp[esp] : await this._getNewScoreAccordingToWorkableScore(esp, espWhere, sender.minScoreByEsp[esp]);
                  // }
                  newScore = esp in sender.minNewScoreByEsp ? sender.minNewScoreByEsp[esp] : await this._getNewScoreAccordingToWorkableScore(esp, espWhere, sender.minScoreByEsp[esp]);
                }
                sender.minNewScoreByEsp[esp] = newScore;

                if (esp in espsScores) {
                  espsScores[esp] = {
                    score: Math.min(sender.minScoreByEsp[esp], espsScores[esp].score),
                    newScore: Math.min(newScore, espsScores[esp].newScore)
                  };
                } else {
                  espsScores[esp] = {
                    score: sender.minScoreByEsp[esp],
                    newScore
                  };
                }
              }
            }
          }
        }
      }

      for (let esp in espsScores) {
        if (isNaN(espsScores[esp].score)) {
          continue;
        }
        let espFilter = null;
        var espNewsFilter = null;
        if (esp != 'default') {
          espFilter = {
            type: 'and',
            children: [
              {
                type: 'fieldValue',
                operator: '=',
                value: esp,
                valueType: 'string',
                field: 'esp'
              },
              {
                type: 'fieldValue',
                operator: '>=',
                value: espsScores[esp].score,
                valueType: 'number',
                field: 'activityScore'
              },
              {
                type: 'fieldValue',
                operator: '=',
                value: ContactStatus.workable,
                valueType: 'string',
                field: 'status'
              }
            ]
          };
          if (!isNaN(espsScores[esp].newScore)) {
            espNewsFilter = {
              type: 'and',
              children: [
                {
                  type: 'fieldValue',
                  operator: '=',
                  value: esp,
                  valueType: 'string',
                  field: 'esp'
                },
                {
                  type: 'fieldValue',
                  operator: '>=',
                  value: Math.max(espsScores[esp].score, espsScores[esp].newScore),
                  valueType: 'number',
                  field: 'activityScore'
                },
                {
                  type: 'fieldValue',
                  operator: '=',
                  value: ContactStatus.new,
                  valueType: 'string',
                  field: 'status'
                }
              ]
            };
          }
        } else {
          let children = [
            {
              type: 'fieldValue',
              operator: '>=',
              value: espsScores[esp].score,
              valueType: 'number',
              field: 'activityScore'
            },
            {
              type: 'fieldValue',
              operator: '=',
              value: ContactStatus.workable,
              valueType: 'string',
              field: 'status'
            }
          ];

          let espButDefault = Object.keys(espsScores).filter((esp) => {
            return esp != 'default';
          });
          if (espButDefault?.length > 0) {
            children.push({
              type: 'fieldValue',
              operator: 'not_in',
              value: espButDefault,
              valueType: 'string',
              field: 'esp'
            });
          }
          espFilter = {
            type: 'and',
            children
          };

          if (!isNaN(espsScores[esp].newScore)) {
            let children = [
              {
                type: 'fieldValue',
                operator: '>=',
                value: Math.max(espsScores[esp].score, espsScores[esp].newScore),
                valueType: 'number',
                field: 'activityScore'
              },
              {
                type: 'fieldValue',
                operator: '=',
                value: ContactStatus.new,
                valueType: 'string',
                field: 'status'
              }
            ];
            let espButDefault = Object.keys(espsScores).filter((esp) => {
              return esp != 'default';
            });
            if (espButDefault?.length > 0) {
              children.push({
                type: 'fieldValue',
                operator: 'not_in',
                value: espButDefault,
                valueType: 'string',
                field: 'esp'
              });
            }

            espNewsFilter = {
              type: 'and',
              children
            };
          }
        }
        if (espFilter) {
          delivConfig.children.push(espFilter);
        }
        if (espNewsFilter) {
          delivConfig.children.push(espNewsFilter);
        }
      }
    }
    return delivConfig;
  };
};
