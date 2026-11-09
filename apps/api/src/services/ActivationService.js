const log = require('../util/log').getLogger('ActivationService');
const config = require('../util/config');
const moment = require('moment-timezone');
const { Op } = require('sequelize');
const ContactStatus = require('../storage/models/ContactStatus');

const sequelize = require('../storage/sequelize');
const ActivationStatsService = require('./ActivationStatsService');
const ContactEventStatsAggregateService = require('./ContactEventStatsAggregateService');
const SuggestionService = require('./SuggestionService');
const PermissionService = require('./PermissionService');
const InscriptionStatsService = require('./InscriptionStatsService');
const { getCachedSettings } = require('./SettingsService');
const { sendEmail } = require('./ToolsoEmailService');

/**
 * ActivationService
 *
 * This class is responsible for controling the activation of a contacts.
 * It will control how many contacts we try to activate, how many mail we are allowed to send, ...
 */

module.exports = class {
  constructor() {
    this.activationStatsService = new ActivationStatsService();
    this.contactEventStatsAggregateService = new ContactEventStatsAggregateService();
    this.suggestionService = new SuggestionService();
    this.inscriptionStatsService = new InscriptionStatsService();
    this.permissionService = new PermissionService();

    this.ActivationConfig = sequelize.get().models.ActivationConfig;
    this.Contact = sequelize.get().models.Contact;
  }

  async getTodayConfigs() {
    let maxIds = await this.ActivationConfig.findAll({
      attributes: [[sequelize.get().fn('max', sequelize.get().col('id')), 'id']],
      group: ['esp']
    });

    return await this.ActivationConfig.findAll({
      where: {
        id: {
          [Op.in]: maxIds.map((maxId) => maxId.id)
        }
      }
    });
  }

  async getEspHistoryConfigs(esp, fromDate, toDate) {
    return await this.ActivationConfig.findAll({
      where: {
        date: {
          [Op.gte]: fromDate,
          [Op.lte]: toDate
        },
        esp
      },
      order: [['date', 'DESC']]
    });
  }
  async getTodayConfig(esp) {
    let today = moment()
      .tz((await getCachedSettings(['timezone'])).timezone)
      .format('YYYY-MM-DD');

    let todayConfig = await this.ActivationConfig.findOne({
      where: {
        date: today,
        esp
      }
    });
    if (!todayConfig) {
      let lastConfig = await this.ActivationConfig.findOne({
        where: {
          esp
        },
        order: [['date', 'DESC']]
      });
      if (lastConfig) {
        todayConfig = {
          date: today,
          esp,
          config: lastConfig.config
        };
        await this.ActivationConfig.create(todayConfig);
      }
    }

    return todayConfig;
  }

  async updateTodayConfig({ esp, config }) {
    if (!esp) {
      throw new Error('ESP is required');
    }

    let todayConfig = await this.getTodayConfig(esp);
    if (!todayConfig) {
      let today = moment()
        .tz((await getCachedSettings(['timezone'])).timezone)
        .format('YYYY-MM-DD');

      todayConfig = {
        date: today,
        esp,
        config
      };
      await this.ActivationConfig.create(todayConfig);
    } else {
      todayConfig.config = config;
      todayConfig.changed('config', true);
      await todayConfig.save();
    }
    return todayConfig;
  }

  async isAllowedToSendMail(contact) {
    if (!contact) {
      return false;
    }
    if (contact.status == ContactStatus.workable) {
      return true;
    } else if (contact.status != ContactStatus.new) {
      return false;
    }
    if (contact.lastRequestDate) {
      let lastRequestDate = moment.tz(contact.lastRequestDate, (await getCachedSettings(['timezone'])).timezone);
      let now = moment.tz((await getCachedSettings(['timezone'])).timezone);
      if (now.isSame(lastRequestDate, 'day')) {
        log.debug(`The contact has already been requested today, so we don't allow to send mail`);
        return false;
      }
    }

    let config = await this.getTodayConfig(contact.esp);
    if (!config || !config.config) {
      log.debug(`We don't have any activation config, so we allow to send mail`);
      return true;
    }
    config = config.config;
    let activationStats = await this.activationStatsService.getOrCreateTodayStats(contact.esp);

    if (config.maxContactsToReach <= activationStats.request) {
      log.debug(`We have reached the max number of contacts to reach (${config.maxContactsToReach}), so we don't allow to send mail`);
      return false;
    }

    let contactActivationAttempts = contact.stats && contact.stats.request ? contact.stats.request : 0;
    if (config.activationRatioByAttempts) {
      let activationRatio = contactActivationAttempts in config.activationRatioByAttempts ? config.activationRatioByAttempts[contactActivationAttempts] : 0;
      if (Math.random() > activationRatio) {
        log.debug(`We limit the activation for attempts ${contactActivationAttempts} with ratio ${activationRatio}, so we don't allow to send mail`);
        return false;
      }
    }

    return true;
  }

  async isAllowedToSendWelcomeMail(contact) {
    if (!contact) {
      return false;
    }
    if (contact.status == ContactStatus.workable) {
      return true;
    } else if (contact.status != ContactStatus.new) {
      return false;
    }

    let config = await this.getTodayConfig(contact.esp);
    if (!config || !config.config || !config.config.wmCappingEnabled) {
      log.debug(`We don't have any activation config, so we allow to send mail`);
      return true;
    }
    config = config.config;
    let activationStats = await this.activationStatsService.getOrCreateTodayStats(contact.esp);

    if (activationStats.wm_request && config.wmCapping <= activationStats.wm_request) {
      log.debug(`We have reached the max number of contacts to reach (${config.maxContactsToReach}), so we don't allow to send mail`);
      return false;
    }
    return true;
  }

  async adjustAllConfigs() {
    log.debug(`Adjusting all configs...`);
    let allConfigs = await this.getTodayConfigs();
    for (let config of allConfigs) {
      await this.adjustConfig(config);
    }
  }

  async adjustConfig(activationConfig) {
    log.debug(`Adjusting config for ESP ${activationConfig.esp}...`);

    await this._getNewContactsByAttempts(activationConfig.esp);

    if (!activationConfig.config) {
      return;
    }

    let openRateTarget = activationConfig.config.openRateTarget && !isNaN(activationConfig.config.openRateTarget) ? activationConfig.config.openRateTarget : 20;
    let unsubRateTarget = activationConfig.config.unsubRateTarget && !isNaN(activationConfig.config.unsubRateTarget) ? activationConfig.config.unsubRateTarget : 0.5;

    if (typeof openRateTarget === 'string') {
      openRateTarget = parseFloat(openRateTarget);
    }
    if (typeof unsubRateTarget === 'string') {
      unsubRateTarget = parseFloat(unsubRateTarget);
    }
    let yesterday = moment()
      .tz((await getCachedSettings(['timezone'])).timezone)
      .add(-1, 'days')
      .format('YYYY-MM-DD');

    let activationStats = await this.activationStatsService.getActivationStats(yesterday, yesterday, activationConfig.esp);
    if (!activationStats || !activationStats.length) {
      log.debug(`No activation stats for ESP ${activationConfig.esp}... Can't adjust config`);
      return;
    }
    activationStats = activationStats[0];

    if (activationConfig.config.autoUpdateNewRatio) {
      let delivStats = await this.contactEventStatsAggregateService.getDimensionStats(yesterday, yesterday, null, { esp: activationConfig.esp });
      if (!delivStats || !delivStats.totalStats.request) {
        log.debug(`No deliv stats for ESP ${activationConfig.esp}... Can't adjust config`);
        return;
      }
      let unsubRate = (100 * delivStats.totalStats.unsub ?? 0) / delivStats.totalStats.request;
      let openRate = activationStats.request ? (100 * activationStats.unique_open ?? 0) / activationStats.request : null;

      let actualNewRatio = activationConfig.config.newRatio ?? 0;

      if (openRate && openRate > openRateTarget && unsubRate < unsubRateTarget) {
        activationConfig.config.newRatio = actualNewRatio * 1.1;
      } else if (openRate < openRateTarget && unsubRate > unsubRateTarget) {
        activationConfig.config.newRatio = actualNewRatio * 0.7;
      } else if (openRate < openRateTarget * 0.8) {
        activationConfig.config.newRatio = actualNewRatio * 0.7;
      } else if (openRate < openRateTarget) {
        activationConfig.config.newRatio = actualNewRatio * 0.9;
      } else if (unsubRate < unsubRateTarget) {
        activationConfig.config.newRatio = actualNewRatio * 0.9;
      }

      let minRatio = delivStats.totalStats.request ? 10 / delivStats.totalStats.request : 0;

      activationConfig.config.newRatio = Math.min(10, activationConfig.config.newRatio);
      activationConfig.config.newRatio = Math.max(minRatio, activationConfig.config.newRatio);
      activationConfig.config.newRatio = Math.round(activationConfig.config.newRatio * 10000) / 10000;
    }

    activationConfig.changed('config', true);

    await activationConfig.save();
  }

  async checkActivationConfigs() {
    let suggestion_contact_volume = (await getCachedSettings(['suggestion_contact_volume'])).suggestion_contact_volume;
    if (suggestion_contact_volume) {
      let allConfigs = await this.getTodayConfigs();
      for (let config of allConfigs) {
        await this.checkActivationConfig(config);
      }
    }
  }

  async checkActivationConfig(activationConfig) {
    let esp = activationConfig.esp;
    let suggestionStatuts = (await getCachedSettings(['default_suggestion_status'])).default_suggestion_status;
    let fromDate = moment().add(-3, 'days').format('YYYY-MM-DD');
    let toDate = moment().add(-1, 'day').format('YYYY-MM-DD');
    let previousStats = await this.activationStatsService.getActivationStats(fromDate, toDate, esp);
    let lastInscriptionStatsGlobal = await this.inscriptionStatsService.getLastInscriptionStats(fromDate, toDate);
    let lastInscriptionStats = lastInscriptionStatsGlobal.map((inscriptionStat) => inscriptionStat.stats.inscriptionByEsps[esp]);
    let needToBuyMoreContacts = this.needToBuyMoreContacts(activationConfig);
    let suggestionDetail = null;
    if (needToBuyMoreContacts) {
      suggestionDetail = this.getSuggestionToBuyMore(esp, previousStats, lastInscriptionStats);
    } else {
      let needToBuyLessContacts = this.needToBuyLessContacts(activationConfig, previousStats);
      if (needToBuyLessContacts) {
        suggestionDetail = this.getSuggestionToBuyLess(esp, activationConfig, lastInscriptionStats);
      }
    }
    if (suggestionDetail) {
      let createdSuggestion = await this.suggestionService.createSuggestion(suggestionDetail.type, `${suggestionDetail.type}_${esp}`, suggestionDetail, 'medium', 'Toolso', suggestionStatuts);
      let minDeltaVolumeForMail = 100;
      if (Math.abs(suggestionDetail.suggestedDailyVariation) > minDeltaVolumeForMail && !createdSuggestion.updated) {
        await this.sendMail(createdSuggestion);
      }
    }
  }

  needToBuyMoreContacts(activationConfig) {
    return activationConfig.config && activationConfig.config.activationRatioByAttempts && activationConfig.config.activationRatioByAttempts[2] > 0;
  }
  needToBuyLessContacts(activationConfig, previousStats) {
    let moreRemainingThanRequestForFirstAttent = previousStats.map((stat) => stat.request0Attempt - (stat.newsStats.attempts ? stat.newsStats.attempts[0] : 0)).reduce((a, b) => a + b, 0) < 0;

    return activationConfig.config.activationRatioByAttempts && activationConfig.config.activationRatioByAttempts[1] == 0 && moreRemainingThanRequestForFirstAttent;
  }
  getSuggestionToBuyMore(esp, previousStats, lastInscriptionStats) {
    let averageThirdAttemptsQuantity = previousStats.map((stat) => stat.request2Attempt).reduce((a, b) => a + b, 0) / previousStats.length;
    let dailyUniqueNewsVolume = lastInscriptionStats.length > 0 ? Math.round(lastInscriptionStats.map((stat) => stat?.uniqueNews ?? 0).reduce((a, b) => a + b, 0) / lastInscriptionStats.length) : 0;
    let suggestedDailyVolume = Math.max(averageThirdAttemptsQuantity, dailyUniqueNewsVolume / 5) + dailyUniqueNewsVolume;

    if (suggestedDailyVolume < 500) {
      suggestedDailyVolume = Math.round(suggestedDailyVolume / 10) * 10;
    } else {
      suggestedDailyVolume = Math.round(suggestedDailyVolume / 100) * 100;
    }
    let quantityToAdd = suggestedDailyVolume - dailyUniqueNewsVolume;
    if (quantityToAdd < 10) {
      return null;
    }
    let suggestionObjectDetails = {
      esp,
      type: 'increase_contact_volume',
      suggestedDailyVariation: quantityToAdd,
      suggestedDailyVolume: suggestedDailyVolume,
      lastDailyVolume: dailyUniqueNewsVolume
    };
    return suggestionObjectDetails;
  }
  getSuggestionToBuyLess(esp, activationConfig, lastInscriptionStats) {
    let requestCapping = activationConfig.config.maxContactsToReach;
    if (lastInscriptionStats.length <= 0) {
      return null;
    }

    let dailyUniqueNewsVolume = Math.round(lastInscriptionStats.map((stat) => (stat ? stat.uniqueNews : 0)).reduce((a, b) => a + b, 0) / lastInscriptionStats.length);
    let suggestedDailyVolume = requestCapping * 0.8;

    if (suggestedDailyVolume < 500) {
      suggestedDailyVolume = Math.round(suggestedDailyVolume / 10) * 10;
    } else {
      suggestedDailyVolume = Math.round(suggestedDailyVolume / 100) * 100;
    }

    if (dailyUniqueNewsVolume - suggestedDailyVolume < 10) {
      return null;
    }

    let suggestionObjectDetails = {
      esp,
      type: 'reduce_contact_volume',
      suggestedDailyVariation: suggestedDailyVolume - dailyUniqueNewsVolume,
      suggestedDailyVolume: suggestedDailyVolume,
      lastDailyVolume: dailyUniqueNewsVolume
    };
    return suggestionObjectDetails;
  }

  async getBaseUsers(permissionService) {
    let uidObject = await permissionService.getEnterpriseAndUsers(process.env.RESOURCE_UID);
    let tos = [];
    if (uidObject?.entreprise?.users) {
      uidObject?.entreprise?.users?.map((user) => tos.push(user.user.email));
    }
    return tos;
  }

  async sendMail(suggestion) {
    let tos = suggestion.status === 'draft' ? config.supportEmails() : await this.getBaseUsers(this.permissionService);
    try {
      let text = `We advice you to change your daily contact volume on ${suggestion.details.esp}.
      Suggested volume is ${suggestion.details.suggestedDailyVolume} per day (${(suggestion.details.suggestedDailyVariation <= 0 ? '' : '+') + suggestion.details.suggestedDailyVariation}).`;

      await sendEmail(
        'volumeRecommendation',
        `Volume Recommendation for ${suggestion.details.esp} on ${process.env.RESOURCE_UID}`,
        {
          suggestion: suggestion.details,
          link: `${config.publicUrl()}/#/${process.env.RESOURCE_UID}/suggestions/${suggestion.id}`,
          database: process.env.RESOURCE_UID,
          text
        },
        tos
      );
    } catch (ex) {
      log.error(`Failed to send Contact Volume Suggestion email`, ex);
    }
  }

  async _getNewContactsByAttempts(esp) {
    let contacts = await this.Contact.findAll({
      where: {
        status: ContactStatus.new,
        esp: esp
      },
      attributes: ['stats']
    });
    let attempts = {};
    for (let contact of contacts) {
      let contactActivationAttempts = contact.stats && contact.stats.request ? contact.stats.request : 0;
      attempts[contactActivationAttempts] = (attempts[contactActivationAttempts] ?? 0) + 1;
    }
    await this.activationStatsService.setField(esp, 'newsStats', moment(), {
      count: contacts.length,
      attempts
    });

    return { contacts, attempts };
  }
};
