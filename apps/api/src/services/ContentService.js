const { mergeFieldsInObject } = require('./utils/DatabaseUtils');

const log = require('../util/log').getLogger('ContentService');
const config = require('../util/config');
const sequelize = require('../storage/sequelize');
const Sequelize = require('sequelize');
const ContentTemplatePartService = require('./ContentTemplatePartService');
const ContentTemplateService = require('./ContentTemplateService');
const ContentIncomeService = require('./ContentIncomeService');
const PartnerService = require('./PartnerService');
const HistoryService = require('./HistoryService');
const PermissionService = require('./PermissionService');
const moment = require('moment-timezone');
const appendCode = require('./utils/CodeAppender');
const { v4: uuidv4 } = require('uuid');
const { sendEmail } = require('./ToolsoEmailService');
const { getCachedSettings } = require('./SettingsService');
const ContentType = require('../storage/models/ContentType');
var cheerio = require('cheerio');

const { Op } = Sequelize;

module.exports = class {
  constructor() {
    this.Content = sequelize.get()?.models?.Content;
    this.ContentVersion = sequelize.get()?.models?.ContentVersion;
    this.Schedule = sequelize.get()?.models?.Schedule;
    this.History = sequelize.get()?.models?.History;
    this.ContactContent = sequelize.get()?.models?.ContactContent;
    this.ContentStats = sequelize.get()?.models?.ContentStats;
    this.contentTemplatePartService = new ContentTemplatePartService();
    this.contentTemplateService = new ContentTemplateService();
    this.contentIncomeService = new ContentIncomeService();
    this.partnerService = new PartnerService();
    this.historyService = new HistoryService();
    this.permissionService = new PermissionService();
  }

  findWithId = async (id) => {
    return await this.Content.findByPk(id);
  };
  findContentVersionWithId = async (contentId, versionId) => {
    return await this.ContentVersion.findOne({
      where: {
        contentId: contentId,
        id: versionId
      }
    });
  };

  findAll = async (offset = 0, limit = 100, filter = {}) => {
    let where = await this._buildWhereFromFilter(filter);
    let include = [
      ...(filter.scheduleId
        ? [
            {
              model: this.Schedule,
              as: 'schedules',
              through: {
                where: { scheduleId: filter.scheduleId }
              },
              required: false || filter.scheduleId
            }
          ]
        : [])
    ];
    return await this.Content.findAll({
      where: Object.keys(where).length > 0 ? where : null,
      order: [['id', 'DESC']],
      offset: offset,
      limit: limit,
      include
    });
  };
  countAll = async (filter) => {
    let where = await this._buildWhereFromFilter(filter);
    let include = [
      ...(filter.scheduleId
        ? [
            {
              model: this.Schedule,
              as: 'schedules',
              through: {
                where: { scheduleId: filter.scheduleId }
              },
              required: false || filter.scheduleId
            }
          ]
        : [])
    ];
    return await this.Content.count({
      where: Object.keys(where).length > 0 ? where : null,
      include
    });
  };
  async _buildWhereFromFilter(filter) {
    let where = {};
    if (filter) {
      if ('name' in filter) {
        where['name'] = {
          [Op.iLike]: `%${filter['name']}%`
        };
      }
      if ('isActive' in filter && filter.isActive !== null) {
        where['isActive'] = filter.isActive;
      }
      if ('createdFromDate' in filter) {
        where['createdAt'] = {
          [Op.gte]: moment.tz(filter.createdFromDate, 'YYYY-MM-DD', (await getCachedSettings(['timezone'])).timezone).toDate()
        };
      }
      if ('createdToDate' in filter) {
        where['createdAt'] = {
          ...(where['createdAt'] ? where['createdAt'] : {}),
          [Op.lte]: moment
            .tz(filter.createdToDate, 'YYYY-MM-DD', (await getCachedSettings(['timezone'])).timezone)
            .endOf('day')
            .toDate()
        };
      }
      if ('type' in filter && filter.type) {
        where['type'] = filter.type;
      }
      if ('partnerId' in filter && filter.partnerId) {
        where['partnerId'] = filter.partnerId;
      }
    }
    return where;
  }

  createContent = async (name, type) => {
    let content = await this.Content.create({
      name: name,
      isActive: false,
      config: {}
    });

    if (type) {
      content.type = type;
    } else {
      content.type = (await getCachedSettings(['default_content_type'])).default_content_type;
    }

    let contentVersion = await this.ContentVersion.create({
      name: 'Default Version',
      contentId: content.id,
      isDefault: true,
      templateVariables: {}
    });
    if (!('maxSchedule' in content.config)) {
      content.config.maxSchedule = (await getCachedSettings(['content_default_max_schedule'])).content_default_max_schedule;
      content.changed('config', true);
    }

    content.defaultVersionId = contentVersion.id;

    let defaultSchedulesByType = (await getCachedSettings(['defaultSchedulesByType'])).defaultSchedulesByType;
    if (content.type && defaultSchedulesByType && content.type in defaultSchedulesByType && defaultSchedulesByType[content.type].length > 0) {
      for (const scheduleId of defaultSchedulesByType[content.type]) {
        let schedule = await this.Schedule.findByPk(scheduleId);
        if (schedule) {
          await content.addSchedule(schedule);
        }
      }
    }
    await content.save();
    return content;
  };
  createContentVersion = async (contentId) => {
    let content = await this.Content.findByPk(contentId);
    if (content) {
      let contentVersion = await this.ContentVersion.create({
        name: `Version ${(await content.getVersions()).length + 1}`,
        contentId: content.id,
        isDefault: false,
        templateVariables: {}
      });
      return contentVersion;
    }

    return null;
  };

  createCompleteContent = async (content) => {
    let newContent = await this.Content.create({
      name: content.name,
      isActive: content.isActive ? true : false,
      startDate: content.startDate ? content.startDate : null,
      endDate: content.endDate ? content.endDate : null,
      config: content.config ? content.config : {},
      type: content.type ? content.type : (await getCachedSettings(['default_content_type'])).default_content_type,
      partnerId: content.partnerId ? content.partnerId : null,
      category: content.category ? content.category : null
    });
    if (!('maxSchedule' in newContent.config)) {
      newContent.config.maxSchedule = (await getCachedSettings(['content_default_max_schedule'])).content_default_max_schedule;
      newContent.changed('config', true);
    }
    if (content.isActive && (await this.hasInvalidSubjectOrHtml(content, content))) {
      throw new Error('cannot activate an incorrect content');
    }
    if (content.versions && content.versions.length) {
      let needToSetDefault = true;
      for (const versionToCreate in Object.values(content.versions)) {
        let contentVersion = await this.createContentVersionInDatabase(content.versions[versionToCreate], newContent);
        if (needToSetDefault) {
          newContent.defaultVersionId = contentVersion.id;
          needToSetDefault = false;
        }
      }
    } else {
      let contentVersion = await this.createContentVersionInDatabase(content.defaultVersion, newContent);
      newContent.defaultVersionId = contentVersion.id;
    }

    let defaultSchedulesByType = (await getCachedSettings(['defaultSchedulesByType'])).defaultSchedulesByType;
    if (newContent.type && defaultSchedulesByType && newContent.type in defaultSchedulesByType && defaultSchedulesByType[newContent.type].length > 0) {
      for (const scheduleId of defaultSchedulesByType[newContent.type]) {
        let schedule = await this.Schedule.findByPk(scheduleId);
        if (schedule) {
          await newContent.addSchedule(schedule);
        }
      }
    }

    await newContent.save();
    return newContent;
  };
  updateCompleteContent = async (content) => {
    let existingContent = await this.Content.findByPk(content.id);

    if (existingContent) {
      if (content.name) {
        existingContent.name = content.name;
      }

      if (content.type) {
        existingContent.type = content.type;
      }

      if (content.category) {
        existingContent.category = content.category;
      }

      if ('startDate' in content) {
        existingContent.startDate = content.startDate ? content.startDate : null;
      }

      if ('endDate' in content) {
        existingContent.endDate = content.endDate ? content.endDate : null;
      }

      await existingContent.save();

      let defaultVersion = content.defaultVersion;
      let existingVersion = await existingContent.getDefaultVersion();
      if (existingVersion && defaultVersion) {
        if (defaultVersion.contentTemplateId) {
          existingVersion.contentTemplateId = defaultVersion.contentTemplateId;
        }
        if (defaultVersion.templateVariables) {
          existingVersion.templateVariables = defaultVersion.templateVariables;
        }
        if (defaultVersion.html) {
          existingVersion.html = defaultVersion.html;
        }
        if (defaultVersion.previewText) {
          existingVersion.previewText = defaultVersion.previewText;
        }

        if (defaultVersion.subject) {
          existingVersion.subject = defaultVersion.subject;
        }
        if (defaultVersion.frenchEspsSubject) {
          existingVersion.frenchEspsSubject = defaultVersion.frenchEspsSubject;
        }
        if (defaultVersion.senderName) {
          existingVersion.senderName = defaultVersion.senderName;
        }
        await existingVersion.save();
      }
    }
    return existingContent;
  };

  suspendContent = async (contentId, suspendyBy, suspensionReason, additionalText, to, databaseName) => {
    let originalContent = await this.Content.findByPk(contentId);
    originalContent.suspended = true;
    originalContent.suspensionReason = suspensionReason;
    originalContent.isActive = false;
    await originalContent.save();
    if (to) {
      await sendSuspensionMessage(originalContent, suspensionReason, suspendyBy, additionalText, to, databaseName);
    }
    await this.historyService.createHistory(suspendyBy, { suspensionReason, additionalText }, 'content_suspension', 'content', contentId, 5);

    return originalContent;
  };

  duplicateContent = async (id, name, type) => {
    let originalContent = await this.Content.findByPk(id);
    if (!originalContent) {
      return null;
    }
    let config = { ...originalContent.config };
    if (config && config.abTest) {
      config.abTest.versionId = null;
      config.abTest.status = null;
    }

    let duplicatedContent = await this.Content.create({
      name: name,
      isActive: false,
      startDate: originalContent.startDate < new Date() ? new Date() : originalContent.startDate,
      endDate: originalContent.endDate,
      config,
      type: originalContent.type,
      category: originalContent.category,
      partnerId: originalContent.partnerId ?? null
    });

    if (type) {
      duplicatedContent.type = type;
    }

    let originalVersions = await originalContent.getVersions({ where: { archived: false } });
    for (let originalVersion of originalVersions) {
      let duplicatedVersion = await this.ContentVersion.create({
        name: originalVersion.name,
        html: originalVersion.html,
        previewText: originalVersion.previewText,
        frenchEspsSubject: originalVersion.frenchEspsSubject,
        subject: originalVersion.subject,
        senderName: originalVersion.senderName,
        contentId: duplicatedContent.id,
        contentTemplateId: originalVersion.contentTemplateId,
        templateVariables: originalVersion.templateVariables,
        isDefault: originalVersion.isDefault,
        archived: originalVersion.archived,
        disabled: originalVersion.disabled
      });
      if (duplicatedVersion.isDefault) {
        duplicatedContent.defaultVersionId = duplicatedVersion.id;
      }
    }

    let schedules = await originalContent.getSchedules();
    if (schedules && schedules.length > 0) {
      for (let schedule of schedules) {
        await duplicatedContent.addSchedule(schedule);
      }
    }
    await duplicatedContent.save();
    return duplicatedContent;
  };

  deleteContent = async (id) => {
    let originalContent = await this.Content.findByPk(id);
    if (originalContent) {
      if (originalContent.stats && originalContent.stats.request) {
        return null;
      }
      return await originalContent.destroy();
    }
  };

  hasInvalidSubjectOrHtml = async (content) => {
    let allVersions = content.versions ?? (await content.getVersions());
    let versions = allVersions?.filter((version) => {
      return this.isVersionAvailable(version);
    });
    if (!versions || versions.length === 0) {
      versions = [await content.getDefaultVersion()];
    }

    if (!versions || versions.length === 0) {
      return true;
    }

    for (let version of versions) {
      let { html, subject } = await this.compileContentVersion(content, version, {}, false);

      if (!subject || !html) {
        return true;
      }
    }
    return false;
  };

  versionHasInvalidSender = async (contentVersion, theContent) => {
    let content = theContent ?? (await contentVersion.getContent());
    let { requiredDatabaseNameInSenderName, maxDatabasePositionInSenderName } = await getCachedSettings(['requiredDatabaseNameInSenderName', 'maxDatabasePositionInSenderName']);
    let { senderName } = await this.compileContentVersion(content, contentVersion, {}, false);
    if (senderName && requiredDatabaseNameInSenderName && requiredDatabaseNameInSenderName.length > 0) {
      for (var acceptedSenderName of requiredDatabaseNameInSenderName) {
        let index = senderName.toLowerCase().indexOf(acceptedSenderName.toLowerCase());
        if (index >= 0 && index <= maxDatabasePositionInSenderName) {
          return false;
        }
      }
      return true;
    }
    return false;
  };

  updateContent = async (content, user) => {
    let storedContent = await this.Content.findByPk(content.id);
    if (storedContent) {
      if (storedContent.suspended && content.isActive) {
        throw new Error('cannot activate a suspended content');
      }
      if (storedContent.isActive && 'isActive' in content && !content.isActive) {
        await this.historyService.createHistory(user, null, 'content_deactivation', 'content', content.id, 4);
      }
      if (!storedContent.isActive && 'isActive' in content && content.isActive) {
        await this.historyService.createHistory(user, null, 'content_activation', 'content', content.id, 4);
      }

      mergeFieldsInObject(['isActive', 'name', 'startDate', 'endDate', 'config', 'type', 'partnerId', 'category'], content, storedContent);
      if (content.isActive && (await this.hasInvalidSubjectOrHtml(storedContent))) {
        throw new Error('cannot activate an incorrect content');
      }
      await storedContent.save();
    }
    return storedContent;
  };

  updateContentVersion = async (contentVersion) => {
    let storedContentVersion = await this.ContentVersion.findByPk(contentVersion.id);
    let senderName = contentVersion?.senderName ? contentVersion?.senderName : contentVersion?.templateVariables?.senderName;
    if (senderName && senderName.includes('{{contact.')) {
      throw new Error('SenderName cannot have contact variables');
    }

    if (storedContentVersion) {
      mergeFieldsInObject(
        ['html', 'subject', 'frenchEspsSubject', 'senderName', 'name', 'contentTemplateId', 'templateVariables', 'previewText', 'disabled', 'archived'],
        contentVersion,
        storedContentVersion
      );
      if (storedContentVersion?.archived) {
        storedContentVersion.disabled = true;
      }
      if (!storedContentVersion.disabled && (await this.versionHasInvalidSender(storedContentVersion))) {
        throw new Error('senderName need to contain the database Name in the first 20 characters');
      }
      await storedContentVersion.save();
    }
    return storedContentVersion;
  };
  deleteContentVersion = async (contentVersionId) => {
    let storedContentVersion = await this.ContentVersion.findByPk(contentVersionId);
    if (storedContentVersion) {
      let content = await storedContentVersion.getContent();
      let versions = await content.getVersions();
      if (versions.length >= 2) {
        storedContentVersion.archived = true;
        storedContentVersion.disabled = true;
        await storedContentVersion.save();
        return true;
      }
    }
    return false;
  };
  cloneContentVersion = async (contentVersionId) => {
    let storedContentVersion = await this.ContentVersion.findByPk(contentVersionId);
    if (storedContentVersion) {
      let content = await storedContentVersion.getContent();
      let contentVersion = await this.ContentVersion.create({
        name: 'Copy of  ' + storedContentVersion.name,
        contentId: content.id,
        isDefault: false,
        contentTemplateId: storedContentVersion.contentTemplateId,
        templateVariables: storedContentVersion.templateVariables,
        html: storedContentVersion.html,
        previewText: storedContentVersion.previewText,
        subject: storedContentVersion.subject,
        frenchEspsSubject: storedContentVersion.frenchEspsSubject,
        senderName: storedContentVersion.senderName,
        archived: storedContentVersion.archived
      });
      return contentVersion;
    }
    return null;
  };

  scheduleContent = async (contentId, scheduleId) => {
    let content = await this.Content.findByPk(contentId);
    let schedule = await this.Schedule.findByPk(scheduleId);
    if (content && schedule) {
      return await content.addSchedule(schedule);
    }
  };
  unscheduleContent = async (contentId, scheduleId) => {
    let content = await this.Content.findByPk(contentId);
    let schedule = await this.Schedule.findByPk(scheduleId);
    if (content && schedule) {
      return await content.removeSchedule(schedule);
    }
  };

  compileContentVersion = async (content, contentVersion, variables, skipCache = false) => {
    let { language } = await getCachedSettings(['language']);
    if (language) {
      moment.locale(language);
    }
    let template = null;
    if (contentVersion?.contentTemplateId) {
      template = skipCache ? await this.contentTemplateService.findWithId(contentVersion.contentTemplateId) : await this.contentTemplateService.findWithIdInCache(contentVersion.contentTemplateId);
      if (!template) {
        log.warn(`Couldn't find the content template ID ${contentVersion.contentTemplateId} for contentVersion ${contentVersion.id}`);
      }
    }
    let partner = null;
    if (content.partnerId) {
      partner = skipCache ? await this.partnerService.findWithId(content.partnerId) : await this.partnerService.findWithIdFromCache(content.partnerId);
    }

    if (!variables) {
      variables = {
        template_part: {}
      };
    } else {
      variables.template_part = {};
    }
    variables.uuid = uuidv4();
    variables.now = function () {
      return function (text, render) {
        let format = render(text);
        if (!format) {
          return '';
        }
        return moment().format(format);
      };
    };
    variables.urlEncode = function () {
      return function (text, render) {
        return encodeURIComponent(render(text));
      };
    };
    variables.product = {
      uid: process.env.RESOURCE_UID
    };

    if (contentVersion.templateVariables) {
      variables.content = contentVersion.templateVariables;
    }
    variables.content = { ...(variables.content ?? {}), id: content.id };
    if (partner) {
      variables.partner = {
        id: partner.id,
        name: partner.name,
        ...(partner.variables ? partner.variables : {})
      };
    }

    let contentTemplateParts = skipCache ? await this.contentTemplatePartService.findAll() : await this.contentTemplatePartService.findAllInCache();

    for (let contentTemplatePart of contentTemplateParts) {
      variables.template_part[contentTemplatePart.uid] = () => {
        return contentTemplatePart.html;
      };
    }

    let html = template ? template.html : contentVersion.html;
    const mustache = require('mustache');
    mustache.templateCache = undefined;
    html = html ? mustache.render(html, variables) : '';

    let senderName = mustache.render(template && template.senderName ? template.senderName : contentVersion.senderName ? contentVersion.senderName : '', { ...variables, contact: undefined });
    let subject = mustache.render(template && template.subject ? template.subject : contentVersion.subject ? contentVersion.subject : '', variables);
    let frenchEspsSubject = mustache.render(template && template.frenchEspsSubject ? template.frenchEspsSubject : contentVersion.frenchEspsSubject ? contentVersion.frenchEspsSubject : '', variables);
    let previewText = mustache.render(template ? (template.previewText ? template.previewText : '') : contentVersion.previewText ? contentVersion.previewText : '', variables);

    html = mustache.render(html, variables);
    //on compile une troisième fois pour gérer le cas de variables de contacts dans une variable de contenu dans un template part dans un template.
    html = mustache.render(html, variables);

    senderName = mustache.render(senderName, variables);
    subject = mustache.render(subject, variables);
    frenchEspsSubject = frenchEspsSubject ? mustache.render(frenchEspsSubject, variables) : subject;
    previewText = mustache.render(previewText, variables);

    return {
      html,
      senderName,
      subject,
      previewText,
      frenchEspsSubject
    };
  };

  async createContentVersionInDatabase(versionToCreate, newContent) {
    if (await this.versionHasInvalidSender(versionToCreate, newContent)) {
      throw new Error('senderName need to contain the database Name in the first 20 characters of the subject');
    }
    let contentVersion = await this.ContentVersion.create({
      name: versionToCreate.name ?? 'Default Version',
      contentId: newContent.id,
      isDefault: versionToCreate?.is_default ?? true,
      contentTemplateId: versionToCreate ? versionToCreate.contentTemplateId : null,
      templateVariables: versionToCreate ? versionToCreate.templateVariables : {},
      html: versionToCreate ? versionToCreate.html : '',
      previewText: versionToCreate ? versionToCreate.previewText : '',
      frenchEspsSubject: versionToCreate ? versionToCreate.frenchEspsSubject : '',
      subject: versionToCreate ? versionToCreate.subject : '',
      senderName: versionToCreate ? versionToCreate.senderName : ''
    });
    return contentVersion;
  }

  async updateContentsStats() {
    log.debug(`Start to update all content stats`);
    let contents = await this.Content.findAll({
      where: {
        hasToUpdateDelivStats: true
      }
    });
    log.debug(`Find ${contents.length} contents to update`);
    for (let content of contents) {
      await this.updateContentStats(content);
    }
    log.debug(`All content stats have been updated`);
  }

  async updateContentStats(content) {
    log.debug(`Update stats for content[${content.id}]`);

    const ContactEventStatsAggregateService = require('./ContactEventStatsAggregateService');
    let aggregatesStats = await new ContactEventStatsAggregateService().getDimensionStats(null, null, 'esp', {
      content: content.id
    });

    content.delivStats = {
      ...aggregatesStats.totalStats,
      byEsp: {}
    };
    Object.values(aggregatesStats.dimensionsStats).map((dimensionsStat) => {
      content.delivStats.byEsp[dimensionsStat.dimension.id] = dimensionsStat.totalStats;
    });

    content.changed('delivStats', true);
    content.requests = aggregatesStats.totalStats && aggregatesStats.totalStats.request ? aggregatesStats.totalStats.request : 0;

    if (content.isActive && content.requests && content.config && content.config.maxRequests && content.config.maxRequests <= content.requests) {
      //check if we have capping config
      content.isActive = false;
      if (content.config.maxRequestsAlert && content.config.maxRequestsAlertEmails) {
        await sendCappingAlert(content, 'maxRequests');
      }
    }

    if (content.isActive && content.delivStats?.unique_click && content.config && content.config.maxClicks && content.config.maxClicks <= content.delivStats.unique_click) {
      //check if we have capping config
      content.isActive = false;
      if (content.config.maxRequestsAlert && content.config.maxRequestsAlertEmails) {
        await sendCappingAlert(content, 'maxClicks');
      }
    }

    if (content.config && content.config.abTest && content.config.abTest.activated) {
      await this.updateAbTest(content, ContactEventStatsAggregateService);
    }

    let lastAggregatesStats = await new ContactEventStatsAggregateService().getDimensionStats(moment().add(-7, 'days').format('YYYY-MM-DD'), moment().add(0, 'days').format('YYYY-MM-DD'), 'esp', {
      content: content.id
    });
    content.lastDelivStats = lastAggregatesStats.totalStats;
    content.changed('lastDelivStats', true);
    content.lastDelivStatsByEsp = {};
    Object.values(lastAggregatesStats.dimensionsStats).map((dimensionsStat) => {
      content.lastDelivStatsByEsp[dimensionsStat.dimension.id] = dimensionsStat.totalStats;
    });
    content.changed('lastDelivStatsByEsp', true);
    content.hasToUpdateDelivStats = false;

    await this.updateIncomeStats(content);

    await content.save();
  }

  async updateContentStatsTable() {
    let schedules = await this.Schedule.findAll({
      where: {
        scheduleDate: {
          [Op.gte]: moment().add(-1, 'day').startOf('day').toDate(),
          [Op.lte]: moment().add(-1, 'day').endOf('day').toDate()
        }
      }
    });
    let scheduleIds = await schedules.map((schedule) => schedule?.id);
    let offset = 0;
    let limit = 50000;
    let needToFetchMoreContactContents = true;
    let contentStatsToUpdateById = {};
    while (needToFetchMoreContactContents) {
      let updatedContactContents = await this.ContactContent.findAll({
        where: { scheduleId: { [Op.in]: scheduleIds } },
        offset,
        limit
      });
      if (updatedContactContents.length > 0) {
        offset += limit;

        let contentStatFields = [
          'opened',
          'clicked',
          'delivered',
          'unsubcribed',
          'complainted',
          'proxy_loaded',
          'click_accepted',
          'soft_bounced',
          'contact_bounced',
          'content_bounced',
          'hard_bounced'
        ];
        let minOpensToBeAReference = 10;
        for (let contactContent of updatedContactContents) {
          let contentId = contactContent.contentId;
          let contentStats = contentStatsToUpdateById[contentId] ?? (await this.ContentStats.findOne({ where: { content_id: contentId } }));
          if (!contentStats) {
            contentStats = await this.ContentStats.create({
              content_id: contentId,
              requests: 0,
              opened: 0,
              clicked: 0,
              delivered: 0,
              unsubcribed: 0,
              complainted: 0,
              proxy_loaded: 0,
              click_accepted: 0,
              soft_bounced: 0,
              contact_bounced: 0,
              content_bounced: 0,
              hard_bounced: 0,
              ref_opened: 0,
              ref_clicked: 0,
              ref_delivered: 0,
              ref_unsubcribed: 0,
              ref_complainted: 0,
              ref_proxy_loaded: 0,
              ref_click_accepted: 0,
              ref_soft_bounced: 0,
              ref_contact_bounced: 0,
              ref_content_bounced: 0,
              ref_hard_bounced: 0,
              ref_requests: 0
            });
          }

          contentStats['requests']++;
          contentStats['contact_scores'] += contactContent.activityScore;
          if (contactContent.unique_opens >= minOpensToBeAReference) {
            contentStats['ref_requests']++;
            contentStats['ref_contact_scores'] += contactContent.activityScore;
          }

          for (let field of contentStatFields) {
            if (contactContent[field]) {
              contentStats[field]++;
              if (contactContent.unique_opens >= minOpensToBeAReference) {
                contentStats['ref_' + field]++;
              }
            }
          }

          contentStatsToUpdateById[contentId] = contentStats;
        }
      } else {
        needToFetchMoreContactContents = false;
      }
    }
    for (const contentId in contentStatsToUpdateById) {
      await contentStatsToUpdateById[contentId].save();
    }
  }

  async checkContentsStats() {
    log.debug(`Start to update all content stats`);
    let contents = await this.Content.findAll({
      where: {
        isActive: true,
        type: { [Op.ne]: ContentType.welcome_mail }
      }
    });
    log.debug(`Find ${contents.length} contents to update`);
    for (let content of contents) {
      await this.checkContentStats(content);
    }
    log.debug(`All content stats have been updated`);
  }

  async checkContentStats(content) {
    let { auto_suspend_contents, notify_toolso_for_suspensions } = await getCachedSettings(['auto_suspend_contents', 'notify_toolso_for_suspensions']);

    let alertAlreadyRaised = await this.alertAlreadyRaised(content);
    if (!alertAlreadyRaised) {
      let minRequestsToBeConsidered = 80;
      let minRequestsToBeConsideredByEsp = 50;
      let openRateAnomalyThreshold = 5 / 100;
      let openRateOKThreshold = 15 / 100;

      if (content?.lastDelivStats?.request && content.lastDelivStats.request >= minRequestsToBeConsidered) {
        let isOk = await this.checkGlobalContentStats(content, minRequestsToBeConsidered, openRateAnomalyThreshold, openRateOKThreshold, auto_suspend_contents, notify_toolso_for_suspensions);
        if (isOk) {
          isOk = await this.checkContentStatsByEsp(content, minRequestsToBeConsideredByEsp, openRateAnomalyThreshold, openRateOKThreshold, auto_suspend_contents, notify_toolso_for_suspensions);
        }
      }
      await content.save();
    }
  }

  async checkContentStatsByEsp(content, minRequestsToBeConsidered, openRateAnomalyThreshold, openRateOKThreshold, autoSuspend, notifyToolso) {
    const ContactEventStatsAggregateService = require('./ContactEventStatsAggregateService');

    let fromDate = moment().add(-7, 'days').format('YYYY-MM-DD');
    let toDate = moment().add(0, 'days').format('YYYY-MM-DD');
    let contentStatsByEsp = await new ContactEventStatsAggregateService().getDimensionStats(fromDate, toDate, 'esp', { content: content.id });
    let globalStatsByEsp = await new ContactEventStatsAggregateService().getDimensionStats(fromDate, toDate, 'esp', {});
    let statsByEsp = {};
    let excludedEsps = [];
    let includedEsps = [];
    if (content?.config?.filters) {
      excludedEsps = content.config?.filters.find((filter) => filter.type === 'espExclude')?.esps ?? [];
      includedEsps = content.config?.filters.find((filter) => filter.type === 'espInclude')?.esps ?? [];
    }
    if (contentStatsByEsp?.dimensionsStats && globalStatsByEsp?.dimensionsStats) {
      for (let espStats of contentStatsByEsp.dimensionsStats) {
        let esp = espStats.dimension.id;
        if (esp !== 'unknown' && !excludedEsps.includes(esp) && (!includedEsps?.length || includedEsps.includes(esp))) {
          if (!(esp in statsByEsp)) {
            statsByEsp[esp] = { contentRequest: 0, contentBouncesRequest: 0, contentOpen: 0, globalRequest: 0, globalOpen: 0, contentSoftBounce: 0, contentContentBounce: 0, enoughRequests: false };
          }
          let espGlobalStats = globalStatsByEsp.dimensionsStats.find((globalStats) => globalStats.dimension.id === esp);

          if (espStats.byDayStats) {
            let contentDayStats = espStats.byDayStats;
            contentDayStats = contentDayStats.sort((a, b) => (a.day < b.day ? 1 : -1));
            for (let contentDayStat of contentDayStats) {
              if (contentDayStat.day === moment().format('YYYY-MM-DD')) {
                //Today Stats are only use for bounces (negative events) and nt for opening stats (positive events)
                statsByEsp[esp].contentSoftBounce += contentDayStat.stats.soft_bounce;
                statsByEsp[esp].contentContentBounce += contentDayStat.stats.content_bounce;
                statsByEsp[esp].contentBouncesRequest += contentDayStat.stats.request;
              } else {
                if (!statsByEsp[esp].enoughRequests && contentDayStat.stats.request) {
                  statsByEsp[esp].contentBouncesRequest += contentDayStat.stats.request;
                  statsByEsp[esp].contentRequest += contentDayStat.stats.request;
                  statsByEsp[esp].contentSoftBounce += contentDayStat.stats.soft_bounce;
                  statsByEsp[esp].contentContentBounce += contentDayStat.stats.content_bounce;
                  statsByEsp[esp].contentOpen += contentDayStat.stats.unique_open;
                  let day = contentDayStat.day;
                  let globalDayStats = espGlobalStats.byDayStats.find((globalDayStat) => globalDayStat.day === day);
                  statsByEsp[esp].globalRequest += globalDayStats.stats.request;
                  statsByEsp[esp].globalOpen += globalDayStats.stats.unique_open;
                  statsByEsp[esp].enoughRequests = statsByEsp[esp].contentRequest >= minRequestsToBeConsidered;
                }
              }
            }
          }
        }
      }
      let espsWithAnomaly = [];
      for (let esp in statsByEsp) {
        if (statsByEsp[esp].enoughRequests) {
          let espOpenRateOnContent = Math.round((10000 * statsByEsp[esp].contentOpen) / statsByEsp[esp].contentRequest) / 10000;
          let GlobalEspOpenRate = Math.round((10000 * (statsByEsp[esp].globalOpen - statsByEsp[esp].contentOpen)) / (statsByEsp[esp].globalRequest - statsByEsp[esp].contentRequest)) / 10000;
          let bounces = (statsByEsp[esp].contentSoftBounce ?? 0) + (statsByEsp[esp].contentContentBounce ?? 0);
          let bounceAnomaly = bounces > 3 && bounces * 10 >= statsByEsp[esp].contentBouncesRequest;
          if (bounceAnomaly) {
            espsWithAnomaly.push({ esp, bounces, bounceRate: bounces / statsByEsp[esp].contentBouncesRequest, espOpenRate: espOpenRateOnContent, referenceOpenRate: GlobalEspOpenRate });
          } else {
            if (espOpenRateOnContent < openRateAnomalyThreshold && GlobalEspOpenRate > openRateOKThreshold) {
              espsWithAnomaly.push({ esp, espOpenRate: espOpenRateOnContent, referenceOpenRate: GlobalEspOpenRate });
            }
          }
        }
      }
      if (espsWithAnomaly.length > 0) {
        if (autoSuspend) {
          await this.excludedEsps(content, espsWithAnomaly, openRateAnomalyThreshold);
        }
        if (notifyToolso || !autoSuspend) {
          await this.raisePartialAlert(espsWithAnomaly, openRateAnomalyThreshold, content, autoSuspend);
        }
        return false;
      }
    }
    return true;
  }

  async excludedEsps(content, espsWithAnomaly, openRateAnomalyThreshold) {
    if (!content.config.filters) {
      content.config.filters = [];
    }
    let espExcludeFilter = content.config.filters.find((filter) => filter.type === 'espExclude');
    if (!espExcludeFilter) {
      espExcludeFilter = { type: 'espExclude', esps: [] };
      content.config.filters.push(espExcludeFilter);
    }
    for (let espObject of espsWithAnomaly) {
      let esp = espObject.esp;
      if (!espExcludeFilter.esps.includes(esp)) {
        espExcludeFilter.esps.push(esp);
      }
    }
    content.changed('config', true);
    await content.save();
    let historyObject = {
      reason: `Open Rate Anomaly for ${espsWithAnomaly.map((espObject) => espObject.esp).join(', ')}`,
      espsWithAnomaly,
      openRateAnomalyThreshold
    };
    await this.historyService.createHistory('Toolso', { historyObject }, 'esp_exclusion', 'content', content.id, 2);
  }

  async checkGlobalContentStats(content, minRequestsToBeConsidered, openRateAnomalyThreshold, openRateOKThreshold, autoSuspend, notifyToolso) {
    let dayOffset = -1; //we start yesterday
    let schedulesRequests = 0;
    let scheduleOpens = 0;
    let contentRequests = 0;
    let contentOpens = 0;
    const ContactEventStatsAggregateService = require('./ContactEventStatsAggregateService');

    let enoughRequests = false;

    while (dayOffset > -7) {
      let date = moment().add(dayOffset, 'days').format('YYYY-MM-DD');
      let lastSchedulesAggregatedStatsForContent = await new ContactEventStatsAggregateService().getDimensionStats(date, date, 'schedule', { content: content.id });

      for (let stat of lastSchedulesAggregatedStatsForContent.dimensionsStats) {
        let scheduleStatsByEsp = await new ContactEventStatsAggregateService().getDimensionStats(date, date, null, { schedule: stat.dimension.id });

        if (scheduleStatsByEsp?.totalStats && !enoughRequests) {
          schedulesRequests += parseInt(scheduleStatsByEsp.totalStats.request);
          scheduleOpens += parseInt(scheduleStatsByEsp.totalStats.unique_open);
          contentRequests += parseInt(stat.totalStats.request);
          contentOpens += parseInt(stat.totalStats.unique_open);
        }
      }
      dayOffset--;
    }

    if (contentRequests >= minRequestsToBeConsidered) {
      enoughRequests = true;
    }

    if (enoughRequests) {
      let schedulesOpenRate = scheduleOpens / schedulesRequests;
      let contentOpenRate = contentOpens / contentRequests;
      if (schedulesOpenRate > openRateOKThreshold && contentOpenRate < openRateAnomalyThreshold) {
        if (autoSuspend) {
          let uidObject = await this.permissionService.getEnterpriseAndUsers(process.env.RESOURCE_UID);

          let tos = notifyToolso ? config.supportEmails() : [];
          if (uidObject?.entreprise?.users) {
            uidObject?.entreprise?.users?.map((user) => tos.push(user.user.email));
          }

          await this.suspendContent(
            content.id,
            'Toolso',
            'Bad Deliverability',
            `Open Rate ${Math.round(10000 * contentOpenRate) / 100}% is below ${Math.round(10000 * openRateAnomalyThreshold) / 100}. 
          (Reference open Rate for schedule: ${Math.round(10000 * schedulesOpenRate) / 100})`,
            tos,
            uidObject?.emailingDatabase?.name ?? process.env.RESOURCE_UID
          );
        } else {
          await this.raiseGlobalAlertForContent(contentOpenRate, schedulesOpenRate, openRateAnomalyThreshold, content);
        }

        return false;
      }
    }
    return true;
  }

  async raisePartialAlert(espsWithAnomaly, openRateAnomalyThreshold, content, autoSuspend) {
    let historyObject = {
      reason: `Open Rate Anomaly for ${espsWithAnomaly.map((espObject) => espObject.esp).join(', ')}`,
      espsWithAnomaly,
      openRateAnomalyThreshold
    };
    let type = autoSuspend ? 'esp_exclusion' : 'content_suspension_recommendation';
    !autoSuspend && (await this.historyService.createHistory('Toolso', { historyObject }, type, 'content', content.id, 2));
    await sendSuspensionRecommendationMessage(
      content,
      'open_rate_partial_anomaly',
      JSON.stringify(espsWithAnomaly),
      espsWithAnomaly.map((espObject) => espObject.esp),
      autoSuspend
    );
  }

  async raiseGlobalAlertForContent(contentOpenRate, schedulesOpenRate, openRateAnomalyThreshold, content) {
    let historyObject = { reason: 'Open Rate Anomaly', contentOpenRate, schedulesOpenRate, openRateAnomalyThreshold };

    await this.historyService.createHistory('Toolso', { historyObject }, 'content_suspension_recommendation', 'content', content.id, 2);
    await sendSuspensionRecommendationMessage(
      content,
      'open_rate_anomaly',
      `Open Rate ${Math.round(10000 * contentOpenRate) / 100}% is below ${Math.round(10000 * openRateAnomalyThreshold) / 100}. 
            (Reference open Rate for schedule: ${Math.round(10000 * schedulesOpenRate) / 100})`
    );
  }

  async alertAlreadyRaised(content) {
    //If a reco exists in history on this content during the last 24h we don't need to check again
    return await this.History.findOne({
      where: {
        ressource_type: 'content',
        ressource_id: content.id,
        type: 'content_suspension_recommendation',
        createdAt: {
          [Op.gte]: moment().add(-1, 'days').startOf('day')
        }
      },
      order: [['id', 'DESC']],
      limit: 1
    });
  }

  async updateIncomeStats(content) {
    let incomes = await this.contentIncomeService.findAll({ filter: { contentId: content.id }, options: { order: [['date', 'DESC']] } });

    if (incomes && incomes.length) {
      let totalIncomes = {
        estimatedIncome: 0,
        recordedIncome: 0,
        type: incomes[0].type,
        stats: { unique_click: 0, unique_open: 0, request: 0, conversion: 0 }
      };
      let lastIncomes = JSON.parse(JSON.stringify(totalIncomes));
      let lastIncomeCount = 0;
      for (let income of incomes) {
        lastIncomeCount++;
        totalIncomes.estimatedIncome += income.estimatedIncome;
        totalIncomes.recordedIncome += income.recordedIncome;
        totalIncomes.stats.unique_click += income.stats.unique_click ? income.stats.unique_click : 0;
        totalIncomes.stats.unique_open += income.stats.unique_open ? income.stats.unique_open : 0;
        totalIncomes.stats.request += income.stats.request ? income.stats.request : 0;
        totalIncomes.stats.conversion += income.stats.conversion ? income.stats.conversion : 0;

        if (lastIncomes.stats.request < 10000 || lastIncomeCount <= 10) {
          lastIncomes.estimatedIncome += income.estimatedIncome;
          lastIncomes.recordedIncome += income.recordedIncome;
          lastIncomes.stats.unique_click += income.stats.unique_click ? income.stats.unique_click : 0;
          lastIncomes.stats.unique_open += income.stats.unique_open ? income.stats.unique_open : 0;
          lastIncomes.stats.request += income.stats.request ? income.stats.request : 0;
          lastIncomes.stats.conversion += income.stats.conversion ? income.stats.conversion : 0;
        }
      }
      if (totalIncomes.stats.request) {
        totalIncomes.eCpm = (1000 * totalIncomes.estimatedIncome) / totalIncomes.stats.request;
      }
      if (totalIncomes.stats.unique_click) {
        totalIncomes.cpc = totalIncomes.estimatedIncome / totalIncomes.stats.unique_click;
      }
      if (lastIncomes.stats.request) {
        lastIncomes.eCpm = (1000 * lastIncomes.estimatedIncome) / lastIncomes.stats.request;
      }
      if (lastIncomes.stats.unique_click) {
        lastIncomes.cpc = lastIncomes.estimatedIncome / lastIncomes.stats.unique_click;
      }

      content.incomesStats = {
        total: totalIncomes,
        last: lastIncomes
      };
    } else {
      content.incomesStats = {};
    }
    content.changed('incomesStats', true);
  }

  async updateAbTest(content, ContactEventStatsAggregateService) {
    let abTestConfig = content.config.abTest;
    if (abTestConfig.activated && abTestConfig.status !== 'completed') {
      let abTestVolume = abTestConfig.volume ? abTestConfig.volume : 5000;
      if (content.requests >= abTestVolume) {
        let periodInHour = abTestConfig.period ? abTestConfig.period : 1;
        if (!abTestConfig.startTestTs) {
          abTestConfig.startTestTs = new Date().getTime();
          content.changed('config', true);
        } else if (new Date().getTime() - abTestConfig.startTestTs > periodInHour * 3600 * 1000) {
          abTestConfig.status = 'completed';
          let contentVersionsStats = await new ContactEventStatsAggregateService().getDimensionStats(null, null, 'contentVersion', {
            content: content.id
          });

          let versions = await content.getVersions();

          contentVersionsStats.dimensionsStats = contentVersionsStats.dimensionsStats.filter((dStats) => {
            for (let v of versions) {
              if (dStats.dimension && v.id == dStats.dimension.id && !v.disabled) {
                return true;
              }
            }
            return false;
          });

          contentVersionsStats.dimensionsStats.sort((a, b) => {
            let aGoal = null;
            let bGoal = null;
            switch (abTestConfig.goal) {
              case 'click':
                aGoal = a.totalStats.request ? (a.totalStats.unique_click ? a.totalStats.unique_click : 0) / a.totalStats.request : 0;
                bGoal = b.totalStats.request ? (b.totalStats.unique_click ? b.totalStats.unique_click : 0) / b.totalStats.request : 0;
                break;

              default:
              case 'open':
                aGoal = a.totalStats.request ? (a.totalStats.unique_open ? a.totalStats.unique_open : 0) / a.totalStats.request : 0;
                bGoal = b.totalStats.request ? (b.totalStats.unique_open ? b.totalStats.unique_open : 0) / b.totalStats.request : 0;
                break;
            }
            if (aGoal > bGoal) {
              return -1;
            }
            return 1;
          });
          if (contentVersionsStats.dimensionsStats.length) {
            abTestConfig.versionId = contentVersionsStats.dimensionsStats[0].dimension.id;
            abTestConfig.versionLabel = contentVersionsStats.dimensionsStats[0].dimension.label;
          }

          content.changed('config', true);
        }
      }
    }
  }

  async disableOldContents() {
    let result = await this.Content.update(
      {
        isActive: false
      },
      {
        where: {
          isActive: true,
          endDate: {
            [Op.and]: [{ [Op.ne]: null }, { [Op.lte]: new Date() }]
          }
        },
        returning: true
      }
    );
    if (result[1]?.length) {
      Promise.all(
        result[1].map(async (content) => {
          await this.historyService.createHistory('Toolso', { reason: 'End Date Reached', endDate: content.endDate }, 'content_deactivation', 'content', content.id, 3);
        })
      );
    }
  }

  selectVersionToSend(content) {
    if (!content || !content.versions) {
      return null;
    }
    let versions = content.versions.filter((version) => {
      return this.isVersionAvailable(version);
    });
    if (versions.length == 0) {
      return null;
    } else if (versions.length == 1) {
      return versions[0];
    }

    if (content.config && content.config.abTest && content.config.abTest.activated && content.config.abTest.status === 'completed' && content.config.abTest.versionId) {
      let selectedVersion = versions.filter((version) => {
        return version.id == content.config.abTest.versionId;
      });
      if (selectedVersion.length > 0) {
        return selectedVersion[0];
      }
    }

    return versions[Math.floor(Math.random() * versions.length)];
  }

  isVersionAvailable(contentVersion) {
    if (contentVersion.disabled || contentVersion.archived) {
      return false;
    }
    if (contentVersion.contentTemplateId) {
      return true;
    } else {
      return contentVersion.html && contentVersion.subject;
    }
  }

  async insertCodeIn(contentVersionId, code, position) {
    let storedContentVersion = await this.ContentVersion.findByPk(contentVersionId);
    if (storedContentVersion) {
      var cheerioLoadedHtml = cheerio.load(storedContentVersion.html);
      storedContentVersion.html = appendCode(storedContentVersion.html, cheerioLoadedHtml, code, position);

      await storedContentVersion.save();
    }
    return storedContentVersion;
  }

  async getContentsOfSchedule(schedule) {
    let parent = await schedule.getParent();
    let scheduleToCheck = parent ? parent : schedule;
    return await this.getScheduleContents(scheduleToCheck);
  }

  async getScheduleContents(scheduleToCheck) {
    let scheduleContents = await scheduleToCheck.getContents({
      where: {
        [Op.and]: [
          { isActive: true },
          {
            [Op.or]: [{ startDate: null }, { startDate: { [Op.lte]: new Date() } }]
          },
          {
            [Op.or]: [{ endDate: null }, { endDate: { [Op.gte]: new Date() } }]
          }
        ]
      },
      include: [
        {
          model: this.ContentVersion,
          as: 'versions'
        }
      ]
    });
    return scheduleContents;
  }
};
async function sendCappingAlert(content, alertType) {
  try {
    let cappingObject = {
      content,
      maxRequests: content.config.maxRequests,
      maxClicks: content.config.maxClicks,
      requests: content.requests,
      unique_click: content?.delivStats?.unique_click,
      link: `${config.publicUrl()}/#/${process.env.RESOURCE_UID}/contents/list/${content.id}`
    };

    await sendEmail(
      alertType === 'maxClicks' ? 'contentClickCappingReached' : 'contentCappingReached',
      `[${process.env.RESOURCE_UID}][Capping Reached] - ${content.name}`,
      cappingObject,
      content.config.maxRequestsAlertEmails.split(',')
    );

    let historyObject = { reason: 'Capping Reached' };
    if (alertType === 'maxClicks') {
      historyObject.unique_click = cappingObject.unique_click;
      historyObject.maxClicks = cappingObject.maxClicks;
    } else {
      historyObject.requests = cappingObject.requests;
      historyObject.maxRequests = cappingObject.maxRequests;
    }

    await this.historyService.createHistory('Toolso', { historyObject }, 'content_deactivation', 'content', content.id, 4);
  } catch (ex) {
    log.error(`Failed to send content alert`, ex);
  }
}

async function sendSuspensionMessage(content, suspensionReason, suspendyBy, additionalText, to, databaseName) {
  try {
    await sendEmail(
      'contentSuspended',
      `[${databaseName ?? process.env.RESOURCE_UID}] - Content Suspended - ${content.name}`,
      {
        content,
        suspendedBy: suspendyBy,
        suspensionReason: suspensionReason,
        additionalText: additionalText,
        link: `${config.publicUrl()}/#/${process.env.RESOURCE_UID}/contents/list/${content.id}`,
        databaseName
      },
      to
    );
  } catch (ex) {
    log.error(`Failed to send content alert`, ex);
  }
}

async function sendSuspensionRecommendationMessage(content, suspensionReason, additionalText, esps, autoSuspend) {
  try {
    await sendEmail(
      'contentSuspendRecommendation',
      `[${process.env.RESOURCE_UID}] - ${autoSuspend ? 'Esp Exclusions' : 'Content Suspend Recommendation for esps : '} ${esps && esps.length > 0 ? esps.join(', ') : ''} - ${content.name}`,
      {
        content,
        suspendedBy: 'Toolso',
        suspensionReason: suspensionReason,
        additionalText: additionalText,
        link: `${config.publicUrl()}/#/${process.env.RESOURCE_UID}/contents/list/${content.id}`,
        database: process.env.RESOURCE_UID,
        esps,
        autoSuspend
      },
      config.supportEmails()
    );
  } catch (ex) {
    log.error(`Failed to send content alert`, ex);
  }
}
