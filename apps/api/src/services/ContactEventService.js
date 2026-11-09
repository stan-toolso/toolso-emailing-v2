const log = require('../util/log').getLogger('ContactEventService');

const sequelize = require('../storage/sequelize');
const EventType = require('../storage/models/EventType');
const ContactEventStatsService = require('./ContactEventStatsService');
const ActivationStatsService = require('./ActivationStatsService');
const IpAddressService = require('./IpAddressService');
const EmailTrackingDedupService = require('./EmailTrackingDedupService');

//événements issus du pixel de tracking ou du tracking des liens
const PIXEL_TRACKING_EVENT_TYPES = [EventType.click, EventType.open, EventType.proxy_loaded, EventType.click_validation_checked];
const { Op, QueryTypes } = require('sequelize');
const { getCachedSettings, getSettings } = require('./SettingsService');
const moment = require('moment-timezone');
const ContactStatus = require('../storage/models/ContactStatus');

module.exports = class {
  constructor() {
    this.sequelizeObject = sequelize.get();
    this.ContactEventStats = this.sequelizeObject?.models?.ContactEventStats;
    this.ContactEvent = this.sequelizeObject?.models?.ContactEvent;
    this.ContactContent = this.sequelizeObject?.models?.ContactContent;
    this.Contact = this.sequelizeObject?.models?.Contact;
    this.activationStatsService = new ActivationStatsService();

    this.contactEventStatsService = new ContactEventStatsService();
    this.ipAddressService = new IpAddressService();
    this.emailTrackingDedupService = new EmailTrackingDedupService();

    const MirrorService = require('./MirrorService');
    this.mirrorService = new MirrorService();
  }

  findWithId = async (id) => {
    return await this.ContactEvent.findByPk(id);
  };

  findAll = async (offset = 0, limit = 100, filter = {}) => {
    let where = await this._buildWhereFromFilter(filter);
    return await this.ContactEvent.findAll({
      where,
      order: [['date', 'DESC']],
      offset,
      limit,
      include: [
        ...(filter.email
          ? [
              {
                model: this.Contact,
                as: 'contact',
                required: true
              }
            ]
          : [])
      ]
    });
  };

  countAll = async (filter) => {
    let where = await this._buildWhereFromFilter(filter);
    return await this.ContactEvent.count({
      where: Object.keys(where).length > 0 ? where : null,
      include: [
        ...(filter.email
          ? [
              {
                model: this.Contact,
                as: 'contact',
                required: true
              }
            ]
          : [])
      ]
    });
  };

  _buildWhereFromFilter = async (filter) => {
    let where = {};
    if (filter) {
      if ('contactId' in filter && filter.contactId) {
        where['contactId'] = filter.contactId;
      }
      if ('type' in filter && filter.type) {
        where['type'] = filter.type;
      }
      if ('messageId' in filter) {
        where['messageId'] = {
          [Op.iLike]: `%${filter['messageId']}%`
        };
      }
      if ('email' in filter && filter.email) {
        where['$contact.email$'] = {
          [Op.iLike]: `%${filter['email']}%`
        };
      }

      if ('fromDate' in filter) {
        where['date'] = {
          [Op.gte]: moment.tz(filter.fromDate, 'YYYY-MM-DD', (await getCachedSettings(['timezone'])).timezone).toDate()
        };
      }
      if ('toDate' in filter) {
        where['date'] = {
          ...(where['date'] ? where['date'] : {}),
          [Op.lte]: moment
            .tz(filter.toDate, 'YYYY-MM-DD', (await getCachedSettings(['timezone'])).timezone)
            .endOf('day')
            .toDate()
        };
      }
    }

    return where;
  };

  insertNewEvent = async (email, eventType, date, messageId, ip, senderId, scheduleId, contentId, contentVersionId, inscriptionId, details, isBat = false, contact, contactScore) => {
    log.debug(`Insert new contact event ${email}, ${eventType}`);
    let contactEvent = this.ContactEvent.build({
      type: eventType,
      date: date,
      messageId: messageId,
      details
    });
    let ipAddressId = null;
    if (messageId && ip) {
      if (isNaN(ip)) {
        let ipAddress = await this.ipAddressService.getIpAddressFromCache(ip);
        if (ipAddress) {
          ipAddressId = ipAddress.id;
        }
      } else {
        let ipAddress = await this.ipAddressService.findWithIdFromCache(ip);
        if (ipAddress) {
          ipAddressId = ipAddress.id;
        }
      }
    }
    let contactContentFound = false;
    let contactContent = null;
    let contactTrackingAllowed = true;
    if (contactEvent.type != EventType.request && contactEvent.type != EventType.no_request) {
      if (messageId) {
        contactContent = await this.ContactContent.findOne({
          where: {
            [Op.and]: [{ messageId: contactEvent.messageId }]
          }
        });
      }
      contactContentFound = contactContent != null;

      //quand le contact a refusé le pixel tracking, on garde les stats agrégées
      //(esp, contenu, schedule, ...) mais on ne stocke plus d'ouverture/clic rattaché au contact :
      //aucun flag sur le ContactContent, pas de ContactEvent stocké,
      //déduplication via EmailTrackingDedupService (hash anonyme, purgé)
      if (PIXEL_TRACKING_EVENT_TYPES.includes(eventType)) {
        if (!contact) {
          contact = contactContent?.contactId
            ? await this.Contact.findByPk(contactContent.contactId)
            : await this.Contact.findOne({
                where: {
                  email: email
                }
              });
        }
        contactTrackingAllowed = contact?.pixelTrackingConsent !== false;
      }

      if (contactContent && eventType == EventType.click) {
        if (contactTrackingAllowed) {
          contactEvent.isUnique = !contactContent.clicked;
          contactContent.clicked = true;
          if (details?.accepted && !contactContent?.click_accepted) {
            contactEvent.unique_click_accepted = true;
            if (contactContent) {
              contactContent.click_accepted = true;
            }
          }
        } else {
          contactEvent.isUnique = await this.emailTrackingDedupService.markEvent(contactEvent.messageId, EventType.click);
          if (details?.accepted) {
            contactEvent.unique_click_accepted = await this.emailTrackingDedupService.markEvent(contactEvent.messageId, 'click_accepted');
          }
        }

        let openRecorded = contactTrackingAllowed ? contactContent?.opened : await this.emailTrackingDedupService.hasEvent(contactEvent.messageId, EventType.open);
        if (!openRecorded) {
          //we got a click without the open event.
          await this.insertNewEvent(
            email,
            EventType.open,
            date,
            messageId,
            ip,
            senderId,
            scheduleId,
            contentId,
            contentVersionId,
            inscriptionId,
            { generatedFromClick: true },
            isBat,
            contact,
            contactScore
          );
        }
      } else if (contactContent && eventType == EventType.open && contactContent) {
        if (contactTrackingAllowed) {
          contactEvent.isUnique = !contactContent?.opened;
          contactContent.opened = true;
        } else {
          contactEvent.isUnique = await this.emailTrackingDedupService.markEvent(contactEvent.messageId, EventType.open);
        }
      } else if (contactContent && eventType == EventType.proxy_loaded && contactContent) {
        if (contactTrackingAllowed) {
          contactEvent.isUnique = !contactContent?.proxy_loaded;
          contactContent.proxy_loaded = true;
        } else {
          contactEvent.isUnique = await this.emailTrackingDedupService.markEvent(contactEvent.messageId, EventType.proxy_loaded);
        }
      } else if (contactContent && eventType === EventType.delivered && contactContent && !contactContent.delivered) {
        contactEvent.isUnique = !contactContent.delivered;
        contactContent.delivered = true;
      } else if (contactContent && eventType == EventType.click_validation_checked && contactContent) {
        if (contactTrackingAllowed) {
          contactEvent.isUnique = !contactContent.click_accepted;
          contactContent.click_accepted = true;
        } else {
          contactEvent.isUnique = await this.emailTrackingDedupService.markEvent(contactEvent.messageId, 'click_accepted');
        }
      } else if (contactContent && eventType == EventType.contact_bounce) {
        contactContent.contact_bounced = true;
      } else if (contactContent && eventType == EventType.content_bounce) {
        contactContent.content_bounced = true;
      } else if (contactContent && eventType == EventType.soft_bounce) {
        contactContent.soft_bounced = true;
      } else if (contactContent && eventType == EventType.hard_bounce) {
        contactContent.hard_bounced = true;
      } else if (contactContent && eventType == EventType.unsub) {
        contactContent.unsubcribed = true;
      } else if (contactContent && eventType == EventType.complaint) {
        contactContent.complainted = true;
      }

      contactEvent.scheduleId = contactContent ? contactContent.parentScheduleId : null;
      contactEvent.contentId = contactContent ? contactContent.contentId : null;
      contactEvent.senderId = contactContent ? contactContent.senderId : null;
      contactEvent.contentVersionId = contactContent ? contactContent.contentVersionId : null;

      let contactContentEsp = contactContent?.esp;
      let contactContentInscriptionId = contactContent?.inscriptionId;
      let contactContentSourceId = contactContent?.sourceId;
      let contactContentIpAddressId = contactContent?.ipAddressId;
      let fieldMissingInContactContent = !contactContent || !contactContentInscriptionId || !contactContentSourceId || !contactContentEsp || !contactContentIpAddressId;
      if (fieldMissingInContactContent) {
        let requestEvent = messageId
          ? await this.ContactEvent.findOne({
              where: {
                [Op.and]: [{ type: EventType.request }, { messageId: contactEvent.messageId }]
              }
            })
          : null;
        if (requestEvent) {
          if (!contactContentEsp && requestEvent.esp) {
            contactContentEsp = requestEvent.esp;
          }
          if (!contactContentInscriptionId && requestEvent.inscriptionId) {
            contactContentInscriptionId = requestEvent.inscriptionId;
          }
          if (!contactContentSourceId && requestEvent.sourceId) {
            contactContentSourceId = requestEvent.sourceId;
          }
          if (!contactContentIpAddressId && requestEvent.ipAddressId) {
            contactContentIpAddressId = requestEvent.ipAddressId;
          }
        }
      }

      if (contactContent) {
        contactEvent.contactId = contactContent.contactId;
        contactEvent.esp = contactContentEsp;
        contactEvent.inscriptionId = contactContentInscriptionId;
        contactEvent.sourceId = contactContentSourceId;
      } else {
        if (!contact) {
          contact = await this.Contact.findOne({
            where: {
              email: email
            }
          });
        }

        if (contact) {
          contactEvent.contactId = contact.id;
          contactEvent.esp = contact.esp;
          contactEvent.sourceId = contact.lastSourceId;
          contactEvent.inscriptionId = contact.lastInscriptionId;
        }
      }
      if (contactTrackingAllowed && contactEvent.contactId && [EventType.click, EventType.complaint, EventType.hard_bounce, EventType.unsub, EventType.open].includes(contactEvent.type)) {
        if (!contact) {
          contact = await this.Contact.findOne({
            where: {
              id: contactEvent.contactId
            }
          });
        }
        log.debug(`Set next status update date to now for contact ${contactEvent.contactId}`);
        if (contact && contact.nextStatusUpdateDate >= moment().add(3, 'hours').toDate()) {
          contact.nextStatusUpdateDate = new Date();
          await contact.save();
        }
      }

      contactEvent.requestDate = contactContent ? contactContent.createdAt : new Date();

      if (contactContent) {
        if (contactContent.status == ContactStatus.new && [EventType.click, EventType.open, EventType.proxy_loaded].includes(contactEvent.type) && contactEvent.isUnique) {
          await this.activationStatsService.incField(contactEvent.esp, `unique_${contactEvent.type}`, contactEvent.requestDate);
        } else if (contactContent.status == ContactStatus.new && [EventType.complaint, EventType.hard_bounce, EventType.soft_bounce, EventType.unsub].includes(contactEvent.type)) {
          await this.activationStatsService.incField(contactEvent.esp, contactEvent.type, contactEvent.requestDate);
        }
      }

      if (ipAddressId) {
        contactEvent.ipAddressId = ipAddressId;
      } else {
        contactEvent.ipAddressId = contactContentIpAddressId;
      }
      if (contactContent) {
        await contactContent.save();
      }
    } else {
      contactContentFound = true;
      contactEvent.scheduleId = scheduleId;
      contactEvent.ipAddressId = ipAddressId;
      contactEvent.senderId = senderId;
      contactEvent.contentId = contentId;
      contactEvent.contentVersionId = contentVersionId;
      contactEvent.inscriptionId = inscriptionId;
      contactEvent.requestDate = date;
      if (!contact) {
        contact = await this.Contact.findOne({
          where: {
            email: email
          }
        });
      }

      if (contact) {
        contactEvent.contactId = contact.id;
        contactEvent.esp = contact.esp;
        contactEvent.sourceId = contact.lastSourceId;
      } else {
        log.warn(`Contact ${email} doesn't exists. Can't create contact event`);
      }
    }
    if (contactEvent.contactId && contactTrackingAllowed) {
      await contactEvent.save();
    }
    if (isBat) {
      log.debug('We skip the event stats, because BAT');
    } else if (contactContentFound) {
      //we update stats only for initiated from toolso (with a request event !)
      await this.contactEventStatsService.updateStatsWithEvent(contactEvent, contactScore ?? contact?.activityScore ?? 50, true);
    } else {
      log.debug('We skip the event stats, because no request');
    }

    return contactEvent;
  };

  getMessageIdFromMirrorId = async (mirrorId) => {
    log.debug(`Get message Id for mirrorId ${mirrorId}`);
    return await this.mirrorService.getMessageId(mirrorId);
  };

  /**
   * Clean old events to keep the database light
   */
  clean = async () => {
    let { contact_event_max_history_days, contact_event_max_lines_to_destroy } = await getSettings(['contact_event_max_history_days', 'contact_event_max_lines_to_destroy']);

    if (!contact_event_max_history_days) {
      log.debug(`No contact_event_max_history_days defined, we can skip this job.`);
      return;
    }

    const minIdResult = await this.sequelizeObject.query(`select min(id) as minid from "ContactEvent"`, {
      type: QueryTypes.SELECT
    });

    if (minIdResult?.length && minIdResult?.length && minIdResult[0].minid) {
      let minId = minIdResult[0].minid;
      const rawResult = await this.sequelizeObject.query(`select id,date from "ContactEvent" where id >= ${minId + contact_event_max_lines_to_destroy} order by id LIMIT 1`, {
        type: QueryTypes.SELECT
      });

      if (rawResult && rawResult.length && rawResult[0]) {
        let maxId = rawResult[0].id;
        let date = rawResult[0].date;

        let daysBetweenCandidateDateAndNow = moment().diff(moment(date), 'days');

        if (contact_event_max_history_days < daysBetweenCandidateDateAndNow) {
          let destroyResult = await this.ContactEvent.destroy({
            where: {
              id: {
                [Op.lt]: maxId,
                [Op.gte]: minId
              }
            }
          });
          log.debug(`Contact event cleaned. Result : ${destroyResult}`);
          return destroyResult;
        }
      }
    }
  };
};
