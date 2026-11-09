const sequelize = require('../storage/sequelize');
const log = require('../util/log').getLogger('InscriptionService');

const ContactService = require('./ContactService');
const SourceService = require('./SourceService');
const ContactStatusService = require('./ContactStatusService');
const ContactEventService = require('./ContactEventService');
const ContactScheduleService = require('./ContactScheduleService');
const ScheduleType = require('../storage/models/ScheduleType');
const { Op } = require('sequelize');
const EventType = require('../storage/models/EventType');
const { getCachedSettings } = require('./SettingsService');
const moment = require('moment-timezone');

const { filterEsp } = require('./inscription_filters/EspFilter');
const { filterEmailPatterns } = require('./inscription_filters/EmailFilter');
const { filterBlacklist } = require('./inscription_filters/BacklistFilter');
const { extractEsp } = require('./EspService');
const ContactStatus = require('../storage/models/ContactStatus');

module.exports = class {
  constructor() {
    this.contactService = new ContactService();
    this.contactStatusService = new ContactStatusService();
    this.contactEventService = new ContactEventService();
    this.sourceService = new SourceService();
    this.contactScheduleService = new ContactScheduleService();
    this.ContactInscription = sequelize.get().models.ContactInscription;
    this.Contact = sequelize.get().models.Contact;
    this.Schedule = sequelize.get().models.Schedule;
    this.ContactSource = sequelize.get().models.ContactSource;
  }

  createContactInscription = async (email, fields, ip, collectUrl, sourceName, scheduleIds, skipWelcomeMail = false) => {
    log.debug(`Create contact inscription for contact ${email} from source ${sourceName}`);

    let espFilter = filterEsp(email);
    if (!espFilter) {
      return {
        success: false,
        dangerous: true,
        inscription: null,
        errorCode: 'esp_excluded',
        message: `Email ${email} belongs to excluded esp list.`
      };
    }
    let emailPatternFilter = filterEmailPatterns(email);

    if (!emailPatternFilter) {
      return {
        success: false,
        dangerous: true,
        inscription: null,
        errorCode: 'email_pattern_excluded',
        message: `Email ${email} matched an exclusion pattern.`
      };
    }

    let emailBlacklistFilter = await filterBlacklist(email);
    if (!emailBlacklistFilter) {
      return {
        success: false,
        dangerous: false,
        inscription: null,
        errorCode: 'email_blacklisted',
        message: `Email ${email} is blacklisted.`
      };
    }

    let contact = await this.contactService.createOrUpdateContact(email, fields);
    if (!contact) {
      return {
        success: false,
        dangerous: false,
        inscription: null,
        errorCode: 'contact_invalid',
        message: `Can't create contact with ${email}`
      };
    }

    let source = await this.sourceService.getSourceFromName(sourceName);
    if (!source?.parentSourceId && source?.defaultChildSourceId) {
      source = await this.getChildSource(source, email, collectUrl, fields, ip, sourceName);
    }

    let lastInscription = await contact.getLastInscription();
    let isFirstToday = true;
    let timezone = (await getCachedSettings(['timezone'])).timezone;
    let startOfday = moment().tz(timezone).startOf('day');

    if (lastInscription && lastInscription.inscriptionDate && moment(lastInscription.inscriptionDate).tz(timezone) >= startOfday) {
      isFirstToday = false;
    }

    let inscription = await this.ContactInscription.create({
      contactId: contact.id,
      sourceId: source ? source.id : null,
      inscriptionDate: new Date(),
      ip: ip,
      sourceName: sourceName,
      collectUrl: collectUrl,
      fields: fields,
      isFirst: !contact.lastInscriptionId,
      isFirstToday
    });
    contact.lastInscriptionId = inscription.id;
    contact.lastSourceId = source ? source.id : null;
    await contact.save();

    if (source && !skipWelcomeMail && (!scheduleIds || scheduleIds.length == 0)) {
      scheduleIds = await this.getScheduleIds(source);
    }
    //TODO : send an event, and send the email later
    await this.onContactInscriptionEvent(inscription, contact, scheduleIds, skipWelcomeMail);

    return {
      success: true,
      inscription
    };
  };

  getDailyRequestCount = async (source, subtype) => {
    let result = 0;
    let timezone = (await getCachedSettings(['timezone'])).timezone;
    if (source?.id) {
      let where = {
        inscriptionDate: {
          [Op.gte]: moment().tz(timezone).startOf('day').toDate()
        }
      };
      if (source?.defaultChildSourceId) {
        let childSourcesIds = (await source.getChildSources()).map((source) => source.id);
        where.sourceId = {
          [Op.in]: childSourcesIds
        };
      } else {
        where.sourceId = source.id;
      }

      if (subtype === 'news') {
        where.isFirstToday = true;
        where.isFirst = true;
      }
      if (subtype === 'uniqueInscriptions') {
        where.isFirstToday = true;
      }
      result = this.ContactInscription.count({
        where: where
      });
    }
    return result;
  };

  getMonthlyRequestCount = async (source, subtype) => {
    let result = 0;
    let timezone = (await getCachedSettings(['timezone'])).timezone;
    if (source?.id) {
      let where = {
        inscriptionDate: {
          [Op.gte]: moment().tz(timezone).startOf('month').toDate()
        }
      };
      if (source?.defaultChildSourceId) {
        let childSourcesIds = (await source.getChildSources()).map((source) => source.id);
        where.sourceId = {
          [Op.in]: childSourcesIds
        };
      } else {
        where.sourceId = source.id;
      }
      if (subtype === 'news') {
        where.isFirstToday = true;
        where.isFirst = true;
      }
      if (subtype === 'uniqueInscriptions') {
        where.isFirstToday = true;
      }
      result = this.ContactInscription.count({
        where: where
      });
    }
    return result;
  };

  getChildSource = async (source, email, collectUrl, fields, ip, sourceName) => {
    let childSources = await source.getChildSources();
    if (childSources) {
      for (let candidate of childSources) {
        if (candidate.childConfig && this.configMatch(candidate.childConfig, email, collectUrl, fields, ip, sourceName)) {
          return candidate;
        }
      }
    }
    let defaultSource = await this.ContactSource.findByPk(source.defaultChildSourceId);
    return defaultSource;
  };

  fieldRespectRule(field, childConfig) {
    if (!childConfig.value) {
      log.error('incorrect settings : no value for rule');
      return false;
    }
    switch (childConfig.operator) {
      case 'startsWith':
        return field && field.startsWith(childConfig.value);
      case 'contains':
        return field && field.toLowerCase().includes(childConfig.value.toLowerCase());

      case 'regExp':
        return field && RegExp(childConfig.value).test(field);
      case 'is':
      case undefined:
        return field && field.toLowerCase() === childConfig.value.toLowerCase();
      default:
        log.error('incorrect settings : unknown operator');
    }
    return false;
  }

  configMatch(childConfig, email, collectUrl, fields, ip, sourceName) {
    let type = childConfig.type;
    switch (type) {
      case 'and': {
        let children = childConfig.children;
        for (let child of children) {
          if (!this.configMatch(child, email, collectUrl, fields, ip)) {
            return false;
          }
        }
        return true;
      }
      case 'or': {
        let children = childConfig.children;
        if (children.length > 0) {
          for (let index in children) {
            let child = children[index];
            if (this.configMatch(child, email, collectUrl, fields, ip)) {
              return true;
            }
          }
          return false;
        }
        return true;
      }
      case 'collectUrl':
        return this.fieldRespectRule(collectUrl, childConfig);
      case 'ip':
        return this.fieldRespectRule(ip, childConfig);
      case 'sourceName':
        return this.fieldRespectRule(sourceName, childConfig);
      case 'esp':
        return this.fieldRespectRule(extractEsp(email), childConfig);
      default:
        return false;
    }
  }

  createContactInscriptionForSource = async (email, fields, ip, collectUrl, source, inscriptionDate, skipWelcomeMail = false) => {
    log.debug(`Create contact inscription for contact ${email} for source ${source.name}`);

    let esp = extractEsp(email);
    if (source.apiSettings && source.apiSettings.filters) {
      for (let filter of source.apiSettings.filters) {
        if (!filter) {
          continue;
        }
        switch (filter.type) {
          case 'espExclude':
            if (esp && filter.esps && filter.esps.includes(esp)) {
              return {
                success: false,
                dangerous: false,
                inscription: null,
                errorCode: 'esp_excluded',
                message: `Email ${email} belongs to excluded esp list.`
              };
            }
            break;
          case 'espInclude':
            if (!esp || (filter.esps && !filter.esps.includes(esp))) {
              return {
                success: false,
                dangerous: false,
                inscription: null,
                errorCode: 'esp_excluded',
                message: `Email ${email} belongs to excluded esp list.`
              };
            }
            break;
          default:
            continue;
        }
      }
    }

    let espFilter = filterEsp(email);
    if (!espFilter) {
      return {
        success: false,
        dangerous: true,
        inscription: null,
        errorCode: 'esp_excluded',
        message: `Email ${email} belongs to excluded esp list.`
      };
    }
    let emailPattnerFilter = filterEmailPatterns(email);

    if (!emailPattnerFilter) {
      return {
        success: false,
        dangerous: true,
        inscription: null,
        errorCode: 'email_pattern_excluded',
        message: `Email ${email} matched an exclusion pattern.`
      };
    }

    let emailBlacklistFilter = await filterBlacklist(email);
    if (!emailBlacklistFilter) {
      return {
        success: false,
        dangerous: false,
        inscription: null,
        errorCode: 'email_blacklisted',
        message: `Email ${email} is blacklisted.`
      };
    }

    let contact = await this.contactService.createOrUpdateContact(email, fields);
    if (!contact) {
      return {
        success: false,
        dangerous: false,
        inscription: null,
        errorCode: 'contact_invalid',
        message: `Can't create contact with ${email}`
      };
    }

    let lastInscription = await contact.getLastInscription();
    let isFirstToday = true;
    let timezone = (await getCachedSettings(['timezone'])).timezone;
    let startOfday = moment().tz(timezone).startOf('day');
    if (lastInscription && lastInscription.inscriptionDate && moment(lastInscription.inscriptionDate).tz(timezone) >= startOfday) {
      isFirstToday = false;
    }

    let inscription = await this.ContactInscription.create({
      contactId: contact.id,
      sourceId: source ? source.id : null,
      inscriptionDate: inscriptionDate ? inscriptionDate : new Date(),
      ip: ip,
      collectUrl: collectUrl,
      fields: fields,
      isFirst: !contact.lastInscriptionId,
      isFirstToday
    });
    contact.lastInscriptionId = inscription.id;
    contact.lastSourceId = source ? source.id : null;
    contact.save();

    //TODO : send an event, and send the email later

    let scheduleIds = skipWelcomeMail ? [] : await this.getScheduleIds(source);
    await this.onContactInscriptionEvent(inscription, contact, scheduleIds, skipWelcomeMail);

    return {
      success: true,
      inscription
    };
  };

  onContactInscriptionEvent = async (inscription, contact, scheduleIds, skipWelcomeMail = false) => {
    contact = await this.contactStatusService.updateContactStatus(contact);
    let defaultInscriptionScheduleId = (await getCachedSettings(['defaultInscriptionScheduleId'])).defaultInscriptionScheduleId;
    if (skipWelcomeMail) {
      log.debug(`We skip the welcome mail.`);
      return;
    } else if (!scheduleIds || scheduleIds.length == 0) {
      if (defaultInscriptionScheduleId) {
        scheduleIds = [defaultInscriptionScheduleId];
        log.debug(`set default scheduleId ${defaultInscriptionScheduleId}`);
      } else {
        log.debug(`No schedule, we can skip it.`);
        return;
      }
    } else {
      log.debug(`scheduleIds : ${scheduleIds.join(', ')}`);
      if (scheduleIds.length === 1) {
        log.debug(`first Schedule : ${scheduleIds[0]}`);
      }
    }
    if (!contact) {
      return;
    }
    if (contact.status != ContactStatus.new && contact.status != ContactStatus.workable) {
      log.debug(`Contact ${contact.email} is not workable, we don't send any email`);
      return;
    }
    if (!inscription.isFirstToday) {
      log.debug(`Contact ${contact.email} already subscribed today, we skip the WM.`);
      return;
    }

    let schedules = await this.Schedule.findAll({
      where: {
        isActive: true,
        id: { [Op.in]: scheduleIds },
        type: ScheduleType.inscription
      }
    });

    if (defaultInscriptionScheduleId && (!schedules || schedules.length === 0)) {
      log.debug(`Given schedules missing, retrying with default schedule`);
      schedules = await this.Schedule.findAll({
        where: {
          isActive: true,
          id: { [Op.in]: [defaultInscriptionScheduleId] },
          type: ScheduleType.inscription
        }
      });
    }

    if (!schedules || schedules.length === 0) {
      log.debug(`No schedules found for inscription ${JSON.stringify(inscription)}`);
    } else {
      log.debug(`at least one schedule found`);
      for (let schedule of schedules) {
        await this.contactScheduleService.scheduleContentToContact(schedule, contact);
      }
    }

    contact = await this.contactStatusService.updateContactStatus(contact);

    return contact;
  };

  findWithId = async (id) => {
    return await this.ContactInscription.findByPk(id);
  };

  findAll = async (offset = 0, limit = 100, filter = {}) => {
    let where = await this._buildWhereFromFilter(filter);

    return await this.ContactInscription.findAll({
      where: Object.keys(where).length > 0 ? where : null,
      order: [['inscriptionDate', 'DESC']],
      offset: offset,
      limit: limit,
      include: [
        {
          model: this.Contact,
          as: 'contact',
          required: false || filter.email || filter.firstname || filter.lastname
        }
      ]
    });
  };
  countAll = async (filter) => {
    let where = await this._buildWhereFromFilter(filter);

    return await this.ContactInscription.count({
      where: Object.keys(where).length > 0 ? where : null,
      include: [
        {
          model: this.Contact,
          as: 'contact',
          required: false || filter.email || filter.firstname || filter.lastname
        }
      ]
    });
  };

  _buildWhereFromFilter = async (filter) => {
    let where = {};
    if (filter) {
      if ('email' in filter && filter.email) {
        where['$contact.email$'] = {
          [Op.iLike]: `%${filter['email']}%`
        };
      }
      if ('firstname' in filter && filter.firstname) {
        where['$contact.firstname$'] = {
          [Op.iLike]: `%${filter['firstname']}%`
        };
      }
      if ('lastname' in filter && filter.lastname) {
        where['$contact.lastname$'] = {
          [Op.iLike]: `%${filter['lastname']}%`
        };
      }
      if ('contactId' in filter && filter.contactId) {
        where['contactId'] = filter.contactId;
      }

      if ('sourceId' in filter) {
        where['sourceId'] = filter.sourceId;
      }
      if ('isFirst' in filter && filter.isFirst !== null && filter.isFirst !== '') {
        where['isFirst'] = filter.isFirst;
      }
      if ('activated' in filter && filter.activated !== null && filter.activated !== '') {
        where['activated'] = filter.activated;
      }
      if ('fromDate' in filter) {
        where['inscriptionDate'] = {
          [Op.gte]: moment.tz(filter.fromDate, 'YYYY-MM-DD', (await getCachedSettings(['timezone'])).timezone).toDate()
        };
      }
      if ('toDate' in filter) {
        where['inscriptionDate'] = {
          ...(where['inscriptionDate'] ? where['inscriptionDate'] : {}),
          [Op.lte]: moment
            .tz(filter.toDate, 'YYYY-MM-DD', (await getCachedSettings(['timezone'])).timezone)
            .endOf('day')
            .toDate()
        };
      }
    }

    return where;
  };

  async getScheduleIds(source) {
    let scheduleIds = [];
    if (!source) {
      return scheduleIds;
    }
    if (source.apiScheduleIds && source.apiScheduleIds.length > 0) {
      scheduleIds = source.apiScheduleIds;
    } else {
      if (source.parentSourceId) {
        let parentSource = await source.getParentSource();
        if (parentSource && parentSource.apiScheduleIds && parentSource.apiScheduleIds.length > 0) {
          scheduleIds = parentSource.apiScheduleIds;
        }
      }
    }
    return scheduleIds;
  }

  async unsubscribeContact(email, url, ip) {
    log.debug(`Unsubscribe contact ${email} from url ${url}`);

    let contact = await this.contactService.findWithEmail(email);
    if (!contact) {
      log.debug(`Contact ${email} not found`);
      return;
    }

    await this.contactEventService.insertNewEvent(
      email,
      EventType.unsub,
      new Date(),
      null, //contact.md5+'_'+new Date().getTime(),
      null,
      null,
      null,
      null,
      null,
      contact.lastInscriptionId,
      {
        url,
        ip
      }
    );
    contact = await this.contactStatusService.updateContactStatus(contact);
    return contact;
  }
};
