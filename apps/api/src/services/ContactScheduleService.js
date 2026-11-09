const sequelize = require('../storage/sequelize');
const ContentSender = require('./ContentSender');
const ExclusionListService = require('./ExclusionListService');
const InclusionListService = require('./InclusionListService');
const ContactEventService = require('./ContactEventService');
const SendingConfigService = require('./SendingConfigService');
const ActivationService = require('./ActivationService');
const ActivationStatsService = require('./ActivationStatsService');
const ContentService = require('./ContentService');
const log = require('../util/log').getLogger('ContactScheduleService');
const { getSettings, getCachedSettings } = require('./SettingsService');
const moment = require('moment-timezone');

const { Op } = require('sequelize');
const EventType = require('../storage/models/EventType');
const { executeStrategy } = require('./scheduleStrategies/executeStrategy');
const ContactStatus = require('../storage/models/ContactStatus');
const EventStats = require('../storage/models/EventStats');
const ScheduleType = require('../storage/models/ScheduleType');

module.exports = class {
  constructor() {
    this.Schedule = sequelize.get().models?.Schedule;
    this.Contact = sequelize.get().models?.Contact;
    this.Content = sequelize.get().models?.Content;
    this.ContentVersion = sequelize.get().models?.ContentVersion;
    this.ContactContent = sequelize.get().models?.ContactContent;
    this.contentSender = new ContentSender();
    this.exclusionListService = new ExclusionListService();
    this.inclusionListService = new InclusionListService();
    this.contactEventService = new ContactEventService();
    this.contentService = new ContentService();
    this.sendingConfigService = new SendingConfigService();
    this.activationService = new ActivationService();
    this.activationStatsService = new ActivationStatsService();

    this.contentCache = {};
    this._timer = setInterval(() => {
      this.contentCache = {};
    }, 5 * 60 * 1000);
    this.scheduleCache = {};
  }

  _getTimezone = async () => {
    if (this.timezone) {
      return this.timezone;
    }
    const { timezone } = await getSettings({ timezone: 'Europe/Paris' });
    this.timezone = timezone;

    return this.timezone;
  };

  _getAcceptableComplaintScoreThresold = async () => {
    if (this.acceptableComplaintScoreThresold) {
      return this.acceptableComplaintScoreThresold;
    }
    const { acceptableComplaintScoreThresold } = await getSettings(['acceptableComplaintScoreThresold']);
    this.acceptableComplaintScoreThresold = acceptableComplaintScoreThresold;
    return this.acceptableComplaintScoreThresold;
  };

  scheduleContentToContactWithIds = async (scheduleId, contactId) => {
    let contact = await this.Contact.findByPk(contactId);
    let schedule = await this.Schedule.findByPk(scheduleId);
    await this.scheduleContentToContact(schedule, contact);
  };

  _getContentfromCache = async (contentId) => {
    if (!(contentId in this.contentCache)) {
      let content = await this.Content.findByPk(contentId);
      this.contentCache[contentId] = content;
      if (content) {
        content.versions = await content.getVersions();
      }
    }
    return this.contentCache[contentId];
  };

  _getSchedulefromCache = async (scheduleId) => {
    if (!(scheduleId in this.scheduleCache)) {
      this.scheduleCache[scheduleId] = await this.Schedule.findByPk(scheduleId);
    }
    return this.scheduleCache[scheduleId];
  };

  sendContentToContactWithIds = async (scheduleId, contactId, contentId, details, contactScore, senderId, contactStatus) => {
    let contact = await this.Contact.findByPk(contactId);
    log.debug(`contact ${contact.email} fetched`);
    let schedule = await this._getSchedulefromCache(scheduleId);
    log.debug(`schedule ${schedule.name} fetched`);
    let content = await this._getContentfromCache(contentId);
    let contentVersion = this.contentService.selectVersionToSend(content);
    log.debug(`version ${contentVersion.name} fetched`);

    let sendingConfig = await this.sendingConfigService.findWithIdInCache(schedule.sendingConfigId);
    log.debug(`sending config ${schedule.sendingConfigId} fetched`);

    let senderConfig = await this.contentSender.extractSenderConfigForContact(schedule, contact, sendingConfig, senderId);
    log.debug(`senderConfig fetched`);
    await this.sendContentToContact(schedule, content, contentVersion, contact, senderConfig, details, contactScore, contactStatus);
  };

  scheduleContentToContact = async (schedule, contact) => {
    if (!contact || !schedule) {
      log.warn(`Can't schedule with null attributes`);
      return;
    }

    log.debug(`Schedule content to contact [${contact.email}] for schedule [${schedule.id},${schedule.name}] `);
    let allContents = await this.resolve_contents(schedule);
    let senderConfig = await this.contentSender.extractSenderConfigForContact(schedule, contact);
    let result = await this.retrieveContentForContact(schedule, contact, allContents, senderConfig);
    if (result) {
      let contentVersion = this.contentService.selectVersionToSend(result.bestContent);
      await this.sendContentToContact(schedule, result.bestContent, contentVersion, contact, senderConfig, result.details);
    }
  };

  async getMarketingPressureStrategy(contact) {
    let featureName = 'marketingPressureStrategies';
    let { marketingPressureStrategies } = await getCachedSettings([featureName]);
    if (marketingPressureStrategies) {
      for (let pressureStrategy of marketingPressureStrategies) {
        if (pressureStrategy.segment) {
          let segmentName = pressureStrategy.segment?.name ?? pressureStrategy.name ?? featureName;
          let segmentOfMarketingPressure = await this.getOrCreateFeatureSegment(contact, segmentName);
          if (pressureStrategy.segment.from > segmentOfMarketingPressure || pressureStrategy.segment.to < segmentOfMarketingPressure) {
            continue;
          }
        }
        if (pressureStrategy.esps && pressureStrategy.esps.length > 0) {
          if (!pressureStrategy.esps.includes(contact.esp)) {
            continue;
          }
        }
        return pressureStrategy;
      }
    }
    return null;
  }

  retrieveContentForContact = async (schedule, contact, allContents, senderConfig, dryMode = false) => {
    let details = getContactEventDetails(allContents);

    let { maxPressureReductionRatio, complaintReductionPolicyLevel } = await getCachedSettings(['maxPressureReductionRatio', 'complaintReductionPolicyLevel']);

    let { contents } = await this._filter_contents_for_contact(contact, allContents);

    let isMatchingMarketingPressure = await this._match_marketing_pressure(contact, maxPressureReductionRatio, complaintReductionPolicyLevel[contact.esp] ?? complaintReductionPolicyLevel.default);

    if (!isMatchingMarketingPressure) {
      details.reason = 'pression_marketing_filter';
      await this._insertNoRequestEvent(contact, schedule, details, dryMode);
      return;
    }

    contents = await this._consolidate_contents_with_affinity_score(contact, contents);

    details.totalContentsForContact = Object.keys(contents).length;
    details.totalNewContentsForContact = Object.values(contents).filter((content) => {
      return content.count == 0;
    }).length;

    details.totalNewContentsForContactByType = {};
    if (details.totalContentsTypes) {
      details.totalContentsTypes.forEach((type) => {
        let contentsOfTypeCount = 0;
        if (details.totalNewContentsForContact) {
          contentsOfTypeCount = Object.values(contents).filter((content) => content.content.type === type && content.count == 0).length;
        }
        details.totalNewContentsForContactByType[type] = contentsOfTypeCount;
      });
    }

    contents = await this._filter_contents_with_scores(senderConfig, contents, contact);

    details.totalContentsForContactWithScores = Object.keys(contents).length;
    details.totalNewContentsForContactWithScores = Object.values(contents).filter((content) => {
      return content.count == 0;
    }).length;

    if (Object.values(contents).length == 0) {
      log.debug(`No contents found for contact ${contact.email} on schedule ${schedule.name}. Details ${JSON.stringify(details)}`);
      details.reason = details.totalContentsForContact > 0 ? 'score_filtered' : 'no_content';
      await this._insertNoRequestEvent(contact, schedule, details, dryMode);

      return;
    }

    let bestContent = await this._select_best_content(contents, schedule, contact, allContents, executeStrategy);
    log.debug(`Best content selected for contact ${contact.email} : ${bestContent.name}`);
    details.bestContentCount = contents[bestContent.id].count;
    return { bestContent, details };
  };

  resolve_contents = async (schedule) => {
    let scheduleContents = await this.contentService.getContentsOfSchedule(schedule);

    let contents = {};
    for (let content of scheduleContents) {
      //TODO: voir si pas moyen de supprimer cet appel ici pour filtrer en amont les contenus sans version dispo
      let contentVersion = this.contentService.selectVersionToSend(content);
      if (contentVersion) {
        contents[content.id] = { content, contentVersion, count: 0, lastOccurenceDays: null };
      }
    }
    return contents;
  };

  _match_marketing_pressure = async (contact, maxPressureReductionRatio, complaintReductionPolicyLevel) => {
    if (contact.status !== 'workable') {
      return true;
    }

    if (!maxPressureReductionRatio || !complaintReductionPolicyLevel) {
      return true;
    }

    if (contact.stats && contact.stats.unique_open > 50) {
      return true;
    }

    let effectiveRatio = ((complaintReductionPolicyLevel * 1.0) / 5) * ((50 - contact.stats?.unique_open ?? 0) / 50.0) * maxPressureReductionRatio;
    let random = Math.random();

    return random > effectiveRatio;
  };

  _filter_contents_for_contact = async (contact, contents) => {
    let contentsByIds = {};
    for (let contentId in contents) {
      contentsByIds[contentId] = {
        ...contents[contentId],
        count: 0,
        lastOccurenceDays: null
      };
    }

    let contentIds = Object.keys(contentsByIds);
    let contactContents = await contact.getContactContents({
      attributes: ['contentId', 'createdAt'],
      where: {
        [Op.or]: [
          {
            contentId: {
              [Op.in]: contentIds
            }
          }
          //on a plus besoin de prendre en plus les 30 derniers jours, car ils sont déjà inclues dans le filtre précédents, et on ne s'intéresse qu'aux contenus inclus dans contents.
          // {
          //   createdAt: {
          //     //on a besoin des 30 derniers jours d'envois pour calculer la pression marketing
          //     [Op.gte]: moment().add(-30, 'days').startOf('day')
          //   }
          // }
        ]
      }
    });

    let matchedContents = {};
    contactContents.forEach((contactContent) => {
      if (!(contactContent.contentId in contentsByIds)) {
        return;
      }
      contentsByIds[contactContent.contentId].count++;

      let days = moment().diff(moment(contactContent.createdAt), 'days');
      contentsByIds[contactContent.contentId].lastOccurenceDays =
        contentsByIds[contactContent.contentId].lastOccurenceDays !== null ? Math.min(days, contentsByIds[contactContent.contentId].lastOccurenceDays) : days;
    });

    for (let contentId in contentsByIds) {
      let content = contentsByIds[contentId].content;
      if (content.requests && content.config && content.config.maxRequests && content.config.maxRequests <= content.requests) {
        continue;
      }
      if (content.delivStats?.unique_click && content.config && content.config.maxClicks && content.config.maxClicks <= content.delivStats.unique_click) {
        continue;
      }
      if (content.config && content.config.abTest && content.config.abTest.activated && content.config.abTest.status !== 'completed') {
        let abTestVolume = content.config.abTest.volume ? content.config.abTest.volume : 5000;
        if (content.requests && content.requests >= abTestVolume) {
          continue;
        }
      }

      let maxSchedule = content.config && 'maxSchedule' in content.config ? content.config.maxSchedule : 0;
      if (maxSchedule > 0 && maxSchedule <= contentsByIds[contentId].count) {
        continue;
      }
      let contentMatched = await this._is_content_match_contact(content, contact);
      if (!contentMatched) {
        continue;
      }
      matchedContents[contentId] = contentsByIds[contentId];
    }

    return { contents: matchedContents, contactContents };
  };

  _is_content_match_contact = async (content, contact) => {
    if (!content.config || !content.config.filters) {
      return true;
    }
    let filters = content.config.filters;

    let timezone = await this._getTimezone();
    if (filters) {
      for (let filter of filters.filter((filter) => filter.type)) {
        switch (filter.type) {
          case 'age': {
            let age = contact.dob ? moment.tz(timezone).diff(moment.tz(contact.dob, 'YYYY-MM-DD', timezone), 'years') : null;
            if ('minAge' in filter && filter.minAge && (!age || age < filter.minAge)) {
              return false;
            } else if ('maxAge' in filter && filter.maxAge && (!age || age > filter.maxAge)) {
              return false;
            }
            break;
          }
          case 'gender':
            if ('gender' in filter && contact.gender != filter.gender) {
              return false;
            }
            break;
          case 'isActivated':
            if (filter.activated !== contact.activated) {
              return false;
            }
            break;
          case 'days': //TODO : A supprimmer une fois que toute la base aura été cleanée et contiendra juste des "daysInclude"
          case 'daysInclude': {
            let dayNumber = await moment().tz(timezone).day();
            if (filter.days && filter.days.indexOf(dayNumber) < 0) {
              return false;
            }
            break;
          }
          case 'daysExclude': {
            let todayDayNumber = await moment().tz(timezone).day();
            if (filter.days && filter.days.indexOf(todayDayNumber) >= 0) {
              return false;
            }
            if (todayDayNumber == 0 && filter.days && filter.days.indexOf(7) >= 0) {
              return false;
            }

            break;
          }
          case 'espExclude': {
            if (filter.esps && filter.esps.indexOf(contact.esp) >= 0) {
              return false;
            }
            break;
          }
          case 'espInclude':
            if (filter.esps && filter.esps.indexOf(contact.esp) < 0) {
              return false;
            }
            break;
          case 'sourceExclude':
            if (filter.sourceIds && filter.sourceIds.indexOf(contact.lastSourceId) >= 0) {
              return false;
            }
            break;

          case 'sourceInclude':
            if (filter.sourceIds && filter.sourceIds.indexOf(contact.lastSourceId) < 0) {
              return false;
            }
            break;
          case 'exclusionList':
            if (filter.exclusionListId) {
              let excluded = await this.exclusionListService.isContactExcluded(contact, filter.exclusionListId);
              if (excluded) {
                return false;
              }
            }
            break;
          case 'inclusionList':
            if (filter.inclusionListId) {
              let included = await this.inclusionListService.isContactIncluded(contact, filter.inclusionListId);
              if (!included) {
                return false;
              }
            }
            break;
          case 'zipcodePrefixes': {
            let prefixes = filter.values ? filter.values.split(',') : [];
            if (filter.subType === 'exclude') {
              let zipcode = contact.zipcode;
              for (let prefix of prefixes) {
                if (zipcode && zipcode.indexOf(prefix.trim()) === 0) {
                  return false;
                }
              }
            } else {
              let zipcode = contact.zipcode;
              let oneMatched = false;
              for (let prefix of prefixes) {
                if (zipcode && zipcode.indexOf(prefix.trim()) === 0) {
                  oneMatched = true;
                  break;
                }
              }
              if (!oneMatched) {
                return false;
              }
            }
            break;
          }
          case 'dob': {
            // pas de return sur un filtre qui passe : les filtres suivants (âge, liste d'exclusion…) doivent aussi être évalués
            if (!contact.dob) {
              return false;
            }
            let dobMonthDay = moment(contact.dob).format('MM-DD');
            let dobMatched;
            if (filter.subType === 'birthday') {
              dobMatched = dobMonthDay === moment.tz(timezone).format('MM-DD');
            } else {
              let from = filter.from;
              let to = filter.to;
              let newYearInsideRange = from > to;
              dobMatched = newYearInsideRange ? from <= dobMonthDay || dobMonthDay <= to : from <= dobMonthDay && dobMonthDay <= to;
            }
            if (!dobMatched) {
              return false;
            }
            break;
          }

          case 'fieldValue': {
            let field = filter.field;
            let contactValue = field === 'customFields' ? contact.customFields[filter.customField] : contact[field];
            let fieldMatched = true;
            switch (filter.operator) {
              case '=':
                fieldMatched = contactValue == filter.value;
                break;
              case '!=':
                fieldMatched = contactValue != filter.value;
                break;
              case '>':
                fieldMatched = contactValue > filter.value;
                break;
              case '>=':
                fieldMatched = contactValue >= filter.value;
                break;
              case '<=':
                fieldMatched = contactValue <= filter.value;
                break;
              case '<':
                fieldMatched = contactValue < filter.value;
                break;
              case 'IS NULL':
                fieldMatched = contactValue == null;
                break;
              case 'IS NOT NULL':
                fieldMatched = contactValue != null;
                break;
              case 'IS TRUE':
                fieldMatched = contactValue == true;
                break;
              case 'IS FALSE':
                fieldMatched = contactValue == false;
                break;
              case 'LIKE':
                fieldMatched = typeof contactValue == 'string' && contactValue.toLowerCase().indexOf(filter.value?.toLowerCase() ?? '') >= 0;
                break;
              case 'NOT LIKE':
                fieldMatched = typeof contactValue == 'string' && contactValue.toLowerCase().indexOf(filter.value?.toLowerCase() ?? '') < 0;
                break;
              default:
                log.warn(`Unsuported operator ${filter.operator}`);
                break;
            }
            if (!fieldMatched) {
              return false;
            }
            break;
          }

          default:
            log.warn(`Unsuported filter type ${filter.type}`);
            break;
        }
      }
    }
    return true;
  };

  _consolidate_contents_with_affinity_score = async (contact, contents) => {
    let activityScore = contact.activityScore ? contact.activityScore : 0;
    for (let contentId in contents) {
      contents[contentId].affinityScore = activityScore;
    }
    return contents;
  };

  _filter_contents_with_scores = async (senderConfig, contents, contact) => {
    let result = {};
    if (!senderConfig || !senderConfig.minScoreByEsp) {
      log.warn(`No min score defined`);
      return result;
    }
    if (senderConfig.activatedContact && !contact.activated) {
      log.info('Contact is not activated');
      return result;
    }
    if (!contact.activated) {
      let timezone = await this._getTimezone();
      if (contact.lastScheduledDate && moment(contact.lastScheduledDate).tz(timezone).isSame(moment(), 'day')) {
        log.info('Contact is not activated, and has already a content scheduled today');
        return result;
      }
    }

    if (!senderConfig.minNewScoreByEsp) {
      senderConfig.minNewScoreByEsp = senderConfig.minScoreByEsp;
    }
    for (let contentId in contents) {
      let affinityScore = contents[contentId].affinityScore;
      let minAffinityScore = null;
      if (contact.status == ContactStatus.workable) {
        if (contact.esp in senderConfig.minScoreByEsp) {
          minAffinityScore = senderConfig.minScoreByEsp[contact.esp];
        } else if ('default' in senderConfig.minScoreByEsp) {
          minAffinityScore = senderConfig.minScoreByEsp['default'];
        }
      } else if (contact.status == ContactStatus.new) {
        if (contact.esp in senderConfig.minNewScoreByEsp && contact.esp in senderConfig.minScoreByEsp) {
          minAffinityScore = Math.max(senderConfig.minNewScoreByEsp[contact.esp], senderConfig.minScoreByEsp[contact.esp]);
        } else if ('default' in senderConfig.minNewScoreByEsp && 'default' in senderConfig.minScoreByEsp) {
          minAffinityScore = Math.max(senderConfig.minNewScoreByEsp['default'], senderConfig.minScoreByEsp['default']);
        }
      }
      if (minAffinityScore !== null && !isNaN(minAffinityScore) && minAffinityScore <= affinityScore) {
        result[contentId] = contents[contentId];
      }
    }
    return result;
  };

  _select_best_content = async (contents, schedule, contact, allContents, executeStrategyMethod) => {
    let sortedContents = Object.values(contents);

    // sort by schedule occurence
    /*sortedContents = sortedContents.sort((a, b) => {
      return contents[a.content.id].count > contents[b.content.id].count ? 1 : -1;
    });
    sortedContents = sortedContents.filter((elem) => contents[elem.content.id].count == contents[sortedContents[0].content.id].count);*/

    // sort by priority
    sortedContents = sortedContents.sort((a, b) => {
      //si on a déjà reçu le contenu, on ne tient pas compte de la priorité
      let aPriority =
        contents[a.content.id].count == 0 && contents[a.content.id].content.config && 'priority' in contents[a.content.id].content.config ? contents[a.content.id].content.config.priority : 1;
      let bPriority =
        contents[b.content.id].count == 0 && contents[b.content.id].content.config && 'priority' in contents[b.content.id].content.config ? contents[b.content.id].content.config.priority : 1;
      return aPriority > bPriority ? -1 : 1;
    });
    let bestPrio =
      contents[sortedContents[0].content.id].count == 0 && contents[sortedContents[0].content.id].content.config && 'priority' in contents[sortedContents[0].content.id].content.config
        ? contents[sortedContents[0].content.id].content.config.priority
        : 1;

    sortedContents = sortedContents.filter((elem) => {
      let priority =
        contents[elem.content.id].count == 0 && contents[elem.content.id].content.config && 'priority' in contents[elem.content.id].content.config
          ? contents[elem.content.id].content.config.priority
          : 1;
      return priority == bestPrio;
    });

    //sort with affinity scores
    sortedContents = sortedContents.sort((a, b) => {
      return contents[a.content.id].affinityScore > contents[b.content.id].affinityScore ? -1 : 1;
    });
    sortedContents = sortedContents.filter((elem) => contents[elem.content.id].affinityScore == contents[sortedContents[0].content.id].affinityScore);

    let contentStrategy = await this.getScheduleContentStrategy(schedule, contact);
    var params = contentStrategy && contentStrategy.params ? contentStrategy.params : {};
    let type = contentStrategy && contentStrategy.type;
    return executeStrategyMethod(sortedContents, allContents, type, params, contact);
  };

  async getOrCreateFeatureSegment(contact, featureName) {
    if (!contact.segmentByFeatures) {
      contact.segmentByFeatures = {};
    }

    if (!(featureName in contact.segmentByFeatures)) {
      contact.segmentByFeatures[featureName] = Math.floor(Math.random() * 100) + 1;
      contact.changed('segmentByFeatures', true);
      await contact.save();
    }
    return contact.segmentByFeatures[featureName];
  }

  async getScheduleContentStrategy(schedule, contact) {
    if (schedule.config && schedule.config.contentStrategies) {
      for (let contentStrategy of schedule.config.contentStrategies) {
        let segmentName = contentStrategy.segment?.name ?? contentStrategy.name ?? contentStrategy.type;
        let strategySegment = await this.getOrCreateFeatureSegment(contact, segmentName);

        if (contentStrategy.segment) {
          if (contentStrategy.segment.from > strategySegment || contentStrategy.segment.to < strategySegment) {
            continue;
          }
        }
        if (contentStrategy.esps && contentStrategy.esps.length > 0) {
          if (!contentStrategy.esps.includes(contact.esp)) {
            continue;
          }
        }
        return contentStrategy;
      }
    }
    return null;
  }

  async sendContentToContact(schedule, bestContent, contentVersion, contact, senderConfig, details, contactScore, contactStatus) {
    try {
      if (schedule.type == ScheduleType.inscription) {
        if (!(await this.activationService.isAllowedToSendWelcomeMail(contact))) {
          await this._insertNoRequestEvent(contact, schedule, {
            reason: 'activation_filter',
            sub_reason: 'no_allowed_to_send_welcome_mail',
            contactRequests: contact.stats && contact.stats.request ? contact.stats.request : 0
          });
          return;
        }
      }
      if (contact.status != ContactStatus.workable && contact.status != ContactStatus.new) {
        await this._insertNoRequestEvent(contact, schedule, { reason: 'status_filter', sub_reason: 'no_allowed_to_send_email', contactStatus: contact.status });
        return;
      }
      // if (!(await this.activationService.isAllowedToSendMail(contact))) {
      //   await this._insertNoRequestEvent(contact, schedule, { reason: 'activation_filter', contactRequests: contact.stats && contact.stats.request ? contact.stats.request : 0 }, false, contactScore);
      //   return;
      // }
      let contactContent = await this.ContactContent.create({
        contentIsUnique: schedule.uniqueContent,
        scheduleId: schedule.id,
        contentId: bestContent.id,
        contentVersionId: contentVersion.id,
        contactId: contact.id,
        activityScore: contactScore ? contactScore : contact.activityScore,
        opened: false,
        clicked: false,
        unsubcribed: false,
        complainted: false,
        proxy_loaded: false,
        click_accepted: false,
        delivered: false,
        soft_bounced: false,
        contact_bounced: false,
        content_bounced: false,
        hard_bounced: false,
        status: contactStatus ? contactStatus : contact.status,
        unique_opens: contact?.stats?.unique_open ?? 0,
        esp: contact.esp,
        parentScheduleId: schedule.parentId ?? schedule.id,
        senderId: senderConfig?.senderId ? parseInt(senderConfig.senderId) : null,
        sourceId: contact.lastSourceId,
        inscriptionId: contact.lastInscriptionId
      });
      if (contact.status == ContactStatus.new && contactContent) {
        await this.activationStatsService.incField(contact.esp, EventStats.request);
        if (schedule.type == ScheduleType.inscription) {
          await this.activationStatsService.incField(contact.esp, 'wm_request');
        }
        if (!contact.stats) {
          contact.stats = {};
        }
        if (!contact.stats.request) {
          contact.stats.request = 0;
        }
        if (contact.stats.request <= 3) {
          await this.activationStatsService.incField(contact.esp, `request${contact.stats.request}Attempt`);
        }
        contact.lastRequestDate = new Date();
        await contact.save();
      }

      try {
        if (contactContent && contentVersion) {
          let event = await this.contentSender.sendContent(schedule, contact, bestContent, contentVersion, senderConfig, false, details, null, null, contactScore);
          if (event && event.messageId) {
            contactContent.messageId = event.messageId;
            contactContent.ipAddressId = event.ipAddressId;
            await contactContent.save();
          }
        }
      } catch (err2) {
        log.error(`Failed to send content ${bestContent.id}, version ${contentVersion.id} to ${contact.email}`, err2);
        let errorDetails = { reason: 'server_error', message: err2.toString() };
        await this._insertNoRequestEvent(contact, schedule, errorDetails);
        throw err2;
      }
    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError') {
        log.warn(`This contact ${contact.email} has already something scheduled`);
        await this._insertNoRequestEvent(contact, schedule, { reason: 'already_scheduled' });
      } else {
        log.error(`Failed to send content to ${contact.email}`, err);
        let errorDetails = { reason: 'server_error', message: err.toString() };
        await this._insertNoRequestEvent(contact, schedule, errorDetails);
        throw err;
      }
    }
  }

  async _insertNoRequestEvent(contact, schedule, details, dryMode) {
    !dryMode &&
      (await this.contactEventService.insertNewEvent(
        contact.email,
        EventType.no_request,
        new Date(),
        null,
        null,
        null,
        schedule.parentId ? schedule.parentId : schedule.id,
        null,
        null,
        contact.lastInscriptionId,
        details,
        false,
        contact
      ));
  }
};
function getContactEventDetails(allContents) {
  let details = {};
  details.totalContents = Object.keys(allContents).length;
  details.totalContentsTypes = [
    ...new Set(
      Object.values(allContents)
        .filter((content) => content.content.type)
        .map((content) => content.content.type)
    )
  ];
  return details;
}
