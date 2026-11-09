const log = require('../util/log').getLogger('ScheduleService');
const config = require('../util/config');
const { mergeFieldsInObject } = require('./utils/DatabaseUtils');
const sequelize = require('../storage/sequelize');
const Sequelize = require('sequelize');
const ScheduleType = require('../storage/models/ScheduleType');
const ScheduleStatus = require('../storage/models/ScheduleStatus');
const { getSettings, getCachedSettings } = require('./SettingsService');
const ActionService = require('./ActionService');
const ContactService = require('./ContactService');
const SendingConfigService = require('./SendingConfigService');
const ContactScheduleService = require('./ContactScheduleService');
const ActivationService = require('./ActivationService');
const SuggestionService = require('./SuggestionService');
const ContentService = require('./ContentService');
const PermissionService = require('./PermissionService');
const HistoryService = require('./HistoryService');
const ContentSender = require('./ContentSender');
const moment = require('moment-timezone');
const ContactStatus = require('../storage/models/ContactStatus');
const ActionType = require('./ActionType');
const EventType = require('../storage/models/EventType');
const { Op, QueryTypes } = Sequelize;
const { PromisePool } = require('@supercharge/promise-pool');
const { getQualityScore } = require('./scoring/qualityScore');
const { sendEmail } = require('./ToolsoEmailService');
const ContactEventStatsAggregateService = require('./ContactEventStatsAggregateService');

module.exports = class {
  constructor(batchSize = 500, maxConcurrency) {
    this.sequelizeObject = sequelize.get();
    this.Schedule = this.sequelizeObject?.models?.Schedule;
    this.ContactEvent = this.sequelizeObject?.models?.ContactEvent;
    this.ContactContent = this.sequelizeObject?.models?.ContactContent;
    this.contactService = new ContactService();
    this.contactScheduleService = new ContactScheduleService();
    this.contentSender = new ContentSender();
    this.contentService = new ContentService();
    this.actionService = new ActionService();
    this.activationService = new ActivationService();
    this.sendingConfigService = new SendingConfigService();
    this.suggestionService = new SuggestionService();
    this.permissionService = new PermissionService();
    this.batchSize = batchSize;
    this.historyService = new HistoryService();
    if (maxConcurrency) {
      this.send_schedule_max_concurrency = maxConcurrency;
    }
  }

  _getTimezone = async () => {
    if (this.timezone) {
      return this.timezone;
    }
    const { timezone } = await getSettings({ timezone: 'Europe/Paris' });
    this.timezone = timezone;
    return this.timezone;
  };

  _getMaxConcurrency = async () => {
    if (this.send_schedule_max_concurrency) {
      return this.send_schedule_max_concurrency;
    }
    const { send_schedule_max_concurrency } = await getSettings(['send_schedule_max_concurrency']);
    this.send_schedule_max_concurrency = send_schedule_max_concurrency;
    return this.send_schedule_max_concurrency;
  };

  _getAcceptableComplaintScoreThresold = async () => {
    if (this.acceptableComplaintScoreThresold) {
      return this.acceptableComplaintScoreThresold;
    }
    const { acceptableComplaintScoreThresold } = await getSettings(['acceptableComplaintScoreThresold']);
    this.acceptableComplaintScoreThresold = acceptableComplaintScoreThresold;
    return this.acceptableComplaintScoreThresold;
  };

  getMarketingPressureStrategies = async () => {
    if (this.marketingPressureStrategies) {
      return this.marketingPressureStrategies;
    }
    const { marketingPressureStrategies } = await getSettings(['marketingPressureStrategies']);
    this.marketingPressureStrategies = marketingPressureStrategies;
    return this.marketingPressureStrategies;
  };

  _getOpenRateAnomalyThreshold = async () => {
    if (this.openRateAnomalyThreshold) {
      return this.openRateAnomalyThreshold;
    }
    const { openRateAnomalyThreshold } = await getSettings(['openRateAnomalyThreshold']);
    this.openRateAnomalyThreshold = openRateAnomalyThreshold;
    return this.openRateAnomalyThreshold;
  };

  _getSuggestionMissingContent = async () => {
    if (!this.suggestion_missing_content) {
      const { suggestion_missing_content } = await getSettings(['suggestion_missing_content']);
      this.suggestion_missing_content = suggestion_missing_content;
    }
    return this.suggestion_missing_content;
  };

  findWithId = async (id) => {
    return await this.Schedule.findByPk(id);
  };
  countAll = async (filter) => {
    let where = await this._buildWhereFromFilter(filter);
    return await this.Schedule.count({
      where: Object.keys(where).length > 0 ? where : null
    });
  };

  findAll = async (offset = 0, limit = 100, filter) => {
    let where = await this._buildWhereFromFilter(filter);

    return await this.Schedule.findAll({
      where,
      order: [['id', 'DESC']],
      offset: offset,
      limit: limit
    });
  };

  async _buildWhereFromFilter(filter) {
    let where = {};
    if (filter) {
      if ('isActive' in filter) {
        where['isActive'] = filter.isActive;
      }
      if ('contentScoresConsolidated' in filter) {
        where['contentScoresConsolidated'] = filter.contentScoresConsolidated;
      }
      if ('types' in filter) {
        where['type'] = {
          [Op.in]: filter.types
        };
      }
      if ('availables' in filter) {
        where[Op.or] = [
          {
            type: {
              [Op.in]: [ScheduleType.inscription, ScheduleType.recurrent]
            }
          },
          {
            [Op.and]: [{ status: ScheduleStatus.waiting }, { type: ScheduleType.single_send }]
          }
        ];
      }

      if ('toScheduleDate' in filter && filter.toScheduleDate) {
        where['scheduleDate'] = {
          [Op.lte]: filter.toScheduleDate
        };
      }

      if ('forCalendar' in filter && filter.fromDate && filter.toDate) {
        let timezone = await this._getTimezone();
        where[Op.or] = [
          {
            type: {
              [Op.in]: [ScheduleType.recurrent]
            }
          },
          {
            type: {
              [Op.in]: [ScheduleType.recurrent_instance, ScheduleType.single_send]
            },
            scheduleDate: {
              [Op.gte]: moment.tz(filter.fromDate, 'YYYY-MM-DD', timezone).startOf('day').toDate(),
              [Op.lte]: moment.tz(filter.toDate, 'YYYY-MM-DD', timezone).endOf('day').toDate()
            }
          }
        ];
      }
    }
    return where;
  }
  deleteSchedule = async (id) => {
    let item = await this.Schedule.findByPk(id);
    if (item) {
      await item.destroy();
    }
  };

  createSchedule = async (name, type) => {
    return await this.Schedule.create({
      name,
      type: type ? type : 'recurrent',
      uniqueContent: type !== 'inscription',
      rate: type === 'recurrent' ? 'day' : null,
      config: {},
      isActive: false,
      status: ScheduleStatus.waiting
    });
  };
  updateSchedule = async (schedule, updatedBy) => {
    let storedSchedule = await this.Schedule.findByPk(schedule.id);
    if (storedSchedule) {
      mergeFieldsInObject(['isActive', 'name', 'config', 'scheduleDate', 'rate', 'sendingConfigId'], schedule, storedSchedule);
      if (!storedSchedule.sendingConfigId) {
        storedSchedule.sendingConfigId = null;
      }

      await storedSchedule.save();
      await this.historyService.createHistory(updatedBy ?? 'Toolso', storedSchedule, 'schedule_update', 'schedule', schedule.id, 3);
    }
    return storedSchedule;
  };

  checkSchedulesHaveEnoughContents = async () => {
    if (!(await this._getSuggestionMissingContent())) {
      return;
    }
    let minScheduleDate = moment().add(-2, 'day').toDate();
    let schedules = await this.Schedule.findAll({
      where: {
        isActive: true,
        scheduleDate: {
          [Op.gte]: minScheduleDate
        },
        status: ScheduleStatus.sent,
        'statusDetails.ended': true,
        'statusDetails.enoug_contents_checked': null,
        'statusDetails.endedDate': { [Op.lte]: moment().add(-2, 'hour').toDate() }
      },
      order: [['id', 'ASC']]
    });
    if (schedules && schedules.length) {
      for (let schedule of schedules) {
        await this.checkScheduleHaveEnoughContents(schedule);
      }
    }
  };

  checkScheduleHaveEnoughContents = async (schedule) => {
    let minContentsForSchedule = schedule.report.minContentsForContact;
    if (!minContentsForSchedule) {
      let suggestion = await this.createSuggestion('totalContents', 'high', minContentsForSchedule, schedule);
      if (suggestion && !suggestion.updated) {
        return await this.sendSuggestion(suggestion.dataValues);
      }
    }
    let minNewContentsForSchedule = schedule.report.minNewContentsForContact;
    if (minNewContentsForSchedule < 2) {
      let suggestion = await this.createSuggestion('newContents', 'medium', minNewContentsForSchedule, schedule);
      if (suggestion && !suggestion.updated) {
        return await this.sendSuggestion(suggestion.dataValues);
      }
    } else if (minNewContentsForSchedule < 5) {
      await this.createSuggestion('newContents', 'low', minNewContentsForSchedule, schedule);
    }
  };

  major = (array) => {
    return array.sort((a, b) => array.filter((v) => v === a).length - array.filter((v) => v === b).length).pop();
  };

  _getTypeOfSchedule = async (schedule) => {
    let contentsOfSchedule = await this.contentService.findAll(0, 100, { scheduleId: schedule.parentId ?? schedule.id });
    let majorType = this.major(contentsOfSchedule.map((content) => content.type));
    return majorType;
  };

  createSuggestion = async (contentType, severity, number, schedule) => {
    let suggestionStatuts = (await getCachedSettings(['default_suggestion_status'])).default_suggestion_status;
    let typeOfSchedule = await this._getTypeOfSchedule(schedule);
    let suggestionDetail = {
      type: 'missing_content',
      contentType,
      typeOfSchedule,
      number,
      scheduleName: schedule.name,
      missingContents: 5 - number
    };
    let createdSuggestion = await this.suggestionService.createSuggestion(suggestionDetail.type, `${suggestionDetail.type}_${typeOfSchedule}`, suggestionDetail, severity, 'Toolso', suggestionStatuts);

    return createdSuggestion;
  };

  getBaseUsers = async (permissionService) => {
    let uidObject = await permissionService.getEnterpriseAndUsers(process.env.RESOURCE_UID);
    let tos = [];
    if (uidObject?.entreprise?.users) {
      uidObject?.entreprise?.users?.map((user) => tos.push(user.user.email));
    }
    return tos;
  };

  sendSuggestion = async (suggestion) => {
    let tos = suggestion.status === 'draft' ? config.supportEmails() : await this.getBaseUsers(this.permissionService);
    let typeLabel = suggestion.details.contentType === 'totalContents' ? 'Contents' : 'New contents';
    try {
      let text = `${typeLabel} of type ${suggestion?.details?.typeOfSchedule} are missing for ${process.env.RESOURCE_UID}.
      Min number of contents by contact : ${suggestion?.details?.number}
      `;

      await sendEmail(
        'missingContents',
        `Missing ${suggestion.details.typeOfSchedule} contents on ${process.env.RESOURCE_UID} ${suggestion.details.scheduleName}`,
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
  };

  checkRecurrentSchedules = async () => {
    log.info('Check recurrent schedules');

    let schedules = await this.Schedule.findAll({
      where: {
        type: ScheduleType.recurrent,
        isActive: true
      }
    });
    for (let schedule of schedules) {
      if (!schedule.scheduleDate || !schedule.rate) {
        return;
      }
      let scheduleDate = null;
      let uid = null;
      let now = moment().tz(await this._getTimezone());
      switch (schedule.rate) {
        case 'day':
          scheduleDate = moment(schedule.scheduleDate).tz(await this._getTimezone());
          scheduleDate = scheduleDate.year(now.year()).month(now.month()).date(now.date());
          uid = `${schedule.id}-${scheduleDate.format('YYYY-MM-DD')}`;
          break;
        default:
          break;
      }

      if (scheduleDate && scheduleDate <= now && moment.duration(now.diff(scheduleDate)).asMinutes() <= 60) {
        let existingInstance = await this.Schedule.findOne({ where: { uid } });
        if (existingInstance) {
          log.debug(`Recurrent instance with uid ${existingInstance.uid} already exists ${existingInstance.id}`);
        } else {
          log.debug(`Create recurrent instance with uid ${uid}`);
          let config = { ...schedule.config };
          let marketingPressureStrategies = await this.getMarketingPressureStrategies();
          if (marketingPressureStrategies) {
            config.marketingPressureStrategies = marketingPressureStrategies;
          }
          let scheduleInstance = this.Schedule.build({
            name: schedule.name,
            config: config,
            parentId: schedule.id,
            type: ScheduleType.recurrent_instance,
            uniqueContent: true,
            uid: uid,
            isActive: true,
            sendingConfigId: schedule.sendingConfigId,
            scheduleDate: scheduleDate.toDate(),
            status: ScheduleStatus.waiting
          });
          await scheduleInstance.save();
        }
      }
    }
  };

  getFilterOfSchedule = async (schedule, includeNews = true) => {
    let filter = {
      type: 'and',
      children: []
    };

    if (schedule.type != ScheduleType.inscription) {
      filter.children.push({
        type: 'fieldValue',
        operator: 'in',
        value: [ContactStatus.workable, ContactStatus.new],
        valueType: 'string',
        field: 'status'
      });
    }

    //schedule config
    if (schedule.config && schedule.config.filter && Object.keys(schedule.config.filter).length > 0) {
      filter.children.push(schedule.config.filter);
    }

    //deliv config
    let sendingConfig = schedule.config && schedule.config.sendingConfig ? schedule.config.sendingConfig : await schedule.getSendingConfig();
    if (sendingConfig) {
      let delivConfig = await this.sendingConfigService.getFilterOfSendingConfig(sendingConfig, includeNews);
      if (schedule.type == ScheduleType.recurrent_instance) {
        if (!schedule.config) {
          schedule.config = {};
        }
        schedule.config.sendingConfig = JSON.parse(JSON.stringify(sendingConfig));
        delete schedule.config.sendingConfig.history;
        schedule.changed('config', true);
        await schedule.save();
      }
      filter.children.push(delivConfig);
    }

    return { filter, sendingConfig };
  };

  checkSchedulesToSend = async () => {
    log.info('Check recurrent schedules');
    let scheduleIdsToSend = await this._getSchedulesToSend();

    for (let scheduleIdToSend of scheduleIdsToSend) {
      let schedule = await this.Schedule.findByPk(scheduleIdToSend.id);
      log.debug(`Start sending of schedule ${schedule.name}`);
      await this._sendScheduleV2(schedule);
    }
  };

  checkSentSchedules = async () => {
    log.info('Check sent schedules');
    await this._checkSentSchedulesStatus();
    await this._checkSentSchedulesOpenRate();
  };

  _checkSentSchedulesStatus = async () => {
    let schedules = await this.Schedule.findAll({
      where: {
        isActive: true,
        scheduleDate: {
          [Op.gte]: moment().add(-1, 'day').toDate(),
          [Op.lte]: moment().add(-2, 'hour').toDate()
        },
        status: { [Op.in]: [ScheduleStatus.sending, ScheduleStatus.waiting] },
        type: 'recurrent_instance'
      }
    });
    if (schedules && schedules.length) {
      schedules.map(async (schedule) => {
        if (!schedule.statusDetails) {
          schedule.statusDetails = {};
        }
        if (!('checkScheduleNotSentAlert' in schedule.statusDetails)) {
          schedule.statusDetails.checkScheduleNotSentAlert = new Date();
          schedule.changed('statusDetails', true);
          this._sendScheduleAlert(schedule, 'Schedule not sent');
          await schedule.save();
        }
      });
    }
  };

  _checkSentSchedulesOpenRate = async () => {
    let minScheduleDate = moment().add(-1, 'day').toDate();

    let schedules = await this.Schedule.findAll({
      where: {
        isActive: true,
        scheduleDate: {
          [Op.gte]: minScheduleDate
        },
        status: ScheduleStatus.sent,
        'statusDetails.ended': true,
        'statusDetails.endedDate': { [Op.lte]: moment().add(-2, 'hour').toDate() },
        'statusDetails.open_rate_checked': null
      }
    });
    let minDeliveryAcceptanceRate = 0.75;
    if (schedules && schedules.length) {
      schedules.map(async (schedule) => {
        let espsWithOpenRateAnomalies = await this._getEspsWithOpenRateAnomalies(schedule);
        if (espsWithOpenRateAnomalies.length) {
          let onlyHotmail = espsWithOpenRateAnomalies.length === 1 && espsWithOpenRateAnomalies[0]?.dimension?.id === 'hotmail';
          let deliveryNotFinished = espsWithOpenRateAnomalies.filter((anomaly) => anomaly.totalStats.delivered > minDeliveryAcceptanceRate * anomaly.totalStats.requests).length === 0;
          let needToCheckAnomalies = (!onlyHotmail && !deliveryNotFinished) || schedule.scheduleDate < moment().add(-6, 'hour').toDate();

          if (needToCheckAnomalies) {
            schedule.statusDetails.open_rate_checked = 'KO';
            let espsWithOpenRateAnomaliesString = espsWithOpenRateAnomalies
              .map((anomaly) => {
                let ORPercentage = Math.round((100 * anomaly.totalStats.open) / anomaly.totalStats.request);
                return `${anomaly.dimension.id} (OpenRate ${ORPercentage}%)`;
              })
              .join(', ');
            await this._sendScheduleAlert(schedule, 'Open Rate anomalies', espsWithOpenRateAnomaliesString);
          }
        } else {
          schedule.statusDetails.open_rate_checked = 'OK';
        }
        schedule.changed('statusDetails', true);
        await schedule.save();
      });
    }
  };

  _getEspsWithOpenRateAnomalies = async (schedule) => {
    let minimunRequestsToBeSignificant = 1000;
    let threshold = await this._getOpenRateAnomalyThreshold();
    let scheduleId = schedule.parentId ?? schedule.id;

    let { dimensionsStats } = await new ContactEventStatsAggregateService().getDimensionStats(
      moment(schedule.scheduleDate)
        .tz(await this._getTimezone())
        .format('YYYY-MM-DD'),
      null,
      'esp',
      {
        schedule: scheduleId,
        minRequest: minimunRequestsToBeSignificant
      }
    );
    dimensionsStats = dimensionsStats.filter((item) => item.totalStats.request * threshold > item.totalStats.open);
    return dimensionsStats;
  };

  async _sendScheduleAlert(schedule, type, esps) {
    let title = type === 'Open Rate anomalies' ? `[${process.env.RESOURCE_UID}] Deliverability Alert ${schedule.name}` : `[${process.env.RESOURCE_UID}] Slow Sending Alert ${schedule.name}`;

    try {
      await sendEmail(
        'scheduleAlert',
        title,
        {
          schedule,
          alertType: type,
          esps,
          link: `${config.publicUrl()}/#/${process.env.RESOURCE_UID}/sendings/deliv`,
          uid: process.env.RESOURCE_UID
        },
        config.supportEmails()
      );
    } catch (ex) {
      log.error(`Failed to send schedule alert`, ex);
    }
  }

  _initStatusDetails = async (schedule, dryMode) => {
    if (!schedule.statusDetails) {
      schedule.statusDetails = {
        offset: 0,
        ended: false,
        startDate: new Date(),
        newContactsReachedByEsp: {}
      };
    }
    if (dryMode && schedule.statusDetails.ended) {
      //if schedule is terminated we can rerun it from the begining in dry mode
      schedule.statusDetails.offset = 0;
    }
    schedule.statusDetails.lastContinue = new Date();
    schedule.statusDetails.ended = false;
    if (!schedule.statusDetails.newContactsReachedByEsp) {
      schedule.statusDetails.newContactsReachedByEsp = {};
    }

    schedule.statusDetails = JSON.parse(JSON.stringify(schedule.statusDetails));

    schedule.changed('statusDetails', true);
    !dryMode && (await schedule.save());
  };

  _initAvailableContents = async (schedule, allContents, dryMode) => {
    schedule.contents_stats = allContents;
    schedule.changed('contents_stats', true);
    !dryMode && (await schedule.save());
  };

  async _updateStatusDetailsEnd(schedule, dryMode) {
    schedule.statusLastDate = new Date();
    schedule.statusDetails.ended = true;
    schedule.statusDetails.endedDate = new Date();
    schedule.status = ScheduleStatus.sent;
    schedule.changed('statusDetails', true);
    !dryMode && (await schedule.save());
  }

  async _updateStatusDetailsWaiting(schedule, dryMode) {
    schedule.statusLastDate = new Date();
    schedule.status = ScheduleStatus.waiting;
    schedule.changed('statusDetails', true);
    !dryMode && (await schedule.save());
  }

  async _updateStatusDetailsProgress(schedule, contactsComputed, dryMode) {
    schedule.statusDetails.offset += contactsComputed;
    schedule.statusLastDate = new Date();
    schedule.changed('statusDetails', true);
    !dryMode && (await schedule.save());
  }

  async _getContactContents() {
    let minCreatedDate = moment().add(-30, 'days').startOf('day');
    const contactContents = await this.sequelizeObject.query(
      `SELECT “contactId”,“contentId”,“createdAt”
      from “ContactContent”
      where “createdAt”>=:minCreatedDate`,
      {
        replacements: {
          minCreatedDate: minCreatedDate.toDate()
        },
        type: QueryTypes.SELECT
      }
    );
    return contactContents;
  }

  async _hasReachedActivationCapping(schedule, esp) {
    if (!schedule.config.activationCappingByEsp) {
      schedule.config.activationCappingByEsp = {};
    }
    let activationCappingByEsp = schedule.config.activationCappingByEsp;
    if (!(esp in activationCappingByEsp)) {
      let activationConfig = await this.activationService.getTodayConfig(esp);

      if (activationConfig && activationConfig.config) {
        let capping = activationConfig.config.maxContactsToReach;
        if ('scheduleRatio' in activationConfig.config && activationConfig.config.scheduleRatio !== null) {
          capping = capping * activationConfig.config.scheduleRatio;
        }
        activationCappingByEsp[esp] = capping;
      } else {
        activationCappingByEsp[esp] = null;
      }
      schedule.changed('config', true);
    }
    if (activationCappingByEsp[esp] != null) {
      let newContactsReachedByEsp = schedule.statusDetails.newContactsReachedByEsp;
      if (newContactsReachedByEsp && esp in newContactsReachedByEsp) {
        return newContactsReachedByEsp[esp] >= activationCappingByEsp[esp];
      }
    }
    return false;
  }

  _sendScheduleV2 = async (schedule, dryMode) => {
    let limitContacts = 20000;
    let maxTimeStampAllowed = 14 * 60 * 1000 + new Date().getTime();
    let stopped = false;
    let isTimeOk = () => {
      return new Date().getTime() < maxTimeStampAllowed;
    };
    await this._initStatusDetails(schedule, dryMode);
    let { filter: scheduleFilter, sendingConfig } = await this.getFilterOfSchedule(schedule);

    let contacts = await this.contactService.findAll(schedule.statusDetails.offset, limitContacts, scheduleFilter, null, [['id', 'ASC']]);
    contacts && log.info(`Fetched ${contacts.length} Contacts from offset ${schedule.statusDetails.offset}`);

    let allContents = await this.contactScheduleService.resolve_contents(schedule);

    await this._initAvailableContents(schedule, allContents, dryMode);

    let actionPayloads = [];
    let contactsComputed = 0;
    while (contacts.length > 0 && !stopped) {
      let concurrency = (await this._getMaxConcurrency()) ?? 10;

      await PromisePool.withConcurrency(concurrency)
        .for(contacts)
        .process(async (contact) => {
          if (isTimeOk()) {
            contactsComputed++;
            let newPayload = await this._handleContact(schedule, contact, allContents, dryMode, sendingConfig);
            newPayload && actionPayloads.push(newPayload);
          } else {
            stopped = true;
          }
          if (actionPayloads.length >= this.batchSize || contactsComputed >= 2 * this.batchSize) {
            let actionPayloadsCopy = [...actionPayloads];
            actionPayloads = [];
            let contactsComputedCopy = contactsComputed;
            contactsComputed = 0;
            await this._sendActionsAndUpdateStatusDetailsProgress(actionPayloadsCopy, contactsComputedCopy, schedule, dryMode);
          }
        });
      contacts = [];
      if (contactsComputed) {
        let actionPayloadsCopy = [...actionPayloads];
        actionPayloads = [];
        let contactsComputedCopy = contactsComputed;
        contactsComputed = 0;
        await this._sendActionsAndUpdateStatusDetailsProgress(actionPayloadsCopy, contactsComputedCopy, schedule, dryMode);
      }
      if (!stopped) {
        contacts = await this.contactService.findAll(schedule.statusDetails.offset, limitContacts, scheduleFilter, null, [['id', 'ASC']]);
        contacts && log.info(`Fetched ${contacts.length} Contacts from offset ${schedule.statusDetails.offset}`);
      }
      !dryMode && (await this._saveAllContents(allContents));
    }
    if (stopped) {
      await this._updateStatusDetailsWaiting(schedule, dryMode);
    } else {
      await this._updateStatusDetailsEnd(schedule, dryMode);
    }
  };

  _getSchedulesToSend = async (limit = 1) => {
    const emails = await this.sequelizeObject.query(
      `UPDATE "Schedule"  SET "status"=:sendingStatus,"statusLastDate"=:now 
            WHERE "id" in (
                SELECT "id" from "Schedule" WHERE 
                    ("type"=:typeRecurrentInstance OR "type"=:typeSingleSend) AND
                    "scheduleDate"<=:now AND
                    (("status"=:waitingStatus) OR
                    (("status"=:sendingStatus) AND "statusLastDate"<=:maxSendingDate))
                    LIMIT :limit
                    FOR UPDATE 
            )
            RETURNING id `,
      {
        replacements: {
          typeRecurrentInstance: ScheduleType.recurrent_instance,
          typeSingleSend: ScheduleType.single_send,
          sendingStatus: ScheduleStatus.sending,
          waitingStatus: ScheduleStatus.waiting,
          limit: limit,
          now: moment().toDate(),
          maxSendingDate: moment().add(-10, 'minutes').toDate()
        },
        type: QueryTypes.SELECT
      }
    );
    return emails;
  };

  updateLastSchedulesReports = async () => {
    log.debug(`update Last Schedules Reports`);

    let schedules = await this.Schedule.findAll({
      where: {
        scheduleDate: {
          [Op.gte]: moment().add(-5, 'hour').toDate()
        },
        type: {
          [Op.in]: [ScheduleType.recurrent_instance, ScheduleType.single_send]
        },
        status: ScheduleStatus.sent
      }
    });
    for (let schedule of schedules) {
      await this.updateReport(schedule.id);
    }
  };

  updateReport = async (scheduleId) => {
    log.debug(`Update report for schedule ${scheduleId}`);
    let schedule = await this.Schedule.findByPk(scheduleId);
    if (!schedule) {
      return;
    }
    let statsScheduleId = schedule.parentId ? schedule.parentId : scheduleId;

    let timezone = await this._getTimezone();
    let events = await this.ContactEvent.findAll({
      where: {
        date: {
          [Op.gte]: moment(schedule.scheduleDate).tz(timezone).startOf('day'),
          [Op.lte]: moment(schedule.scheduleDate).tz(timezone).endOf('day')
        },
        scheduleId: statsScheduleId,
        type: {
          [Op.in]: [EventType.request, EventType.no_request]
        }
      },
      attributes: ['details', 'type'],
      raw: true
    });

    let report = {
      requests: 0,
      no_requests: 0,

      noContentContacts: 0,
      noNewContentContacts: 0,

      minContentsForContact: null,
      maxContentsForContact: null,
      avgContentsForContact: null,

      minNewContentsForContact: null,
      maxNewContentsForContact: null,
      avgNewContentsForContact: null,
      minNewContentsForContactByType: {},
      no_requests_reasons: {}
    };

    if (events.length > 0) {
      for (let event of events) {
        if (event.type == EventType.request) {
          report.requests++;
        } else if (event.type == EventType.no_request) {
          report.no_requests++;
          if (event.details && event.details.reason) {
            if (!(event.details.reason in report.no_requests_reasons)) {
              report.no_requests_reasons[event.details.reason] = 0;
            }
            report.no_requests_reasons[event.details.reason]++;
          }
        }
        if (event.details && 'totalContentsForContact' in event.details) {
          if (event.details.totalContentsForContact == 0) {
            report.noContentContacts++;
          }
          if (report.minContentsForContact === null || event.details.totalContentsForContact < report.minContentsForContact) {
            report.minContentsForContact = event.details.totalContentsForContact;
          }
          if (report.maxContentsForContact === null || event.details.totalContentsForContact > report.maxContentsForContact) {
            report.maxContentsForContact = event.details.totalContentsForContact;
          }
          report.avgContentsForContact += event.details.totalContentsForContact;
        }
        if (event.details && 'totalNewContentsForContact' in event.details) {
          if (event.details.totalNewContentsForContact == 0) {
            report.noNewContentContacts++;
          }
          if (report.minNewContentsForContact === null || event.details.totalNewContentsForContact < report.minNewContentsForContact) {
            report.minNewContentsForContact = event.details.totalNewContentsForContact;
          }

          if (event.details.totalNewContentsForContactByType) {
            for (let type in event.details.totalNewContentsForContactByType) {
              if (!(type in report.minNewContentsForContactByType) || event.details.totalNewContentsForContactByType[type] < report.minNewContentsForContactByType[type]) {
                report.minNewContentsForContactByType[type] = event.details.totalNewContentsForContactByType[type];
              }
            }
          }

          if (report.maxNewContentsForContact === null || event.details.totalNewContentsForContact > report.maxNewContentsForContact) {
            report.maxNewContentsForContact = event.details.totalNewContentsForContact;
          }
          report.avgNewContentsForContact += event.details.totalNewContentsForContact;
        }
      }

      if (report.avgContentsForContact) {
        report.avgContentsForContact = report.avgContentsForContact / events.length;
      }
      if (report.avgNewContentsForContact) {
        report.avgNewContentsForContact = report.avgNewContentsForContact / events.length;
      }
    }
    report.date = new Date();
    schedule.report = report;
    await schedule.save();
  };

  async _saveAllContents(allContents) {
    for (let contentId in allContents) {
      await allContents[contentId].content.save();
    }
  }

  async _sendActionsAndUpdateStatusDetailsProgress(actionPayloads, contactsComputed, schedule, dryMode) {
    log.info(`Push to SQS ${actionPayloads.length} actions with new offset ${contactsComputed + schedule.statusDetails.offset}`);
    await this.actionService.newActionsWithPackage(ActionType.send_content_for_contact, actionPayloads);
    await this._updateStatusDetailsProgress(schedule, contactsComputed, dryMode);
  }

  async _handleContact(schedule, contact, allContents, dryMode, sendingConfig) {
    let senderConfig = await this.contentSender.extractSenderConfigForContact(schedule, contact, sendingConfig);
    let result = await this.contactScheduleService.retrieveContentForContact(schedule, contact, allContents, senderConfig, dryMode);
    if (result) {
      if (contact.status == ContactStatus.new) {
        //update new contacts reached by esp
        if (!(contact.esp in schedule.statusDetails.newContactsReachedByEsp)) {
          schedule.statusDetails.newContactsReachedByEsp[contact.esp] = 0;
        }
        schedule.statusDetails.newContactsReachedByEsp[contact.esp]++;
      }

      result.bestContent.requests += 1;
      return {
        ca: contact.id,
        s: schedule.id,
        ce: result.bestContent.id,
        details: result.details,
        cs: contact.activityScore,
        cst: contact.status,
        sc: senderConfig && senderConfig.senderId ? senderConfig.senderId : null
      };
    }
  }
};
