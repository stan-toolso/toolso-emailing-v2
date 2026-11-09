const log = require('../util/log').getLogger('ContactStatusService');
const moment = require('moment-timezone');
const { getCachedSettings } = require('./SettingsService');
const ContactService = require('./ContactService');
const BlacklistedContactService = require('./BlacklistedContactService');
const ContactComplaintScoreService = require('./ContactComplaintScoreService');
const sequelize = require('../storage/sequelize');
const ContactStatus = require('../storage/models/ContactStatus');
const EventType = require('../storage/models/EventType');
const { extractEsp } = require('./EspService');
var md5 = require('md5');
var sha1 = require('sha1');
var sha256 = require('js-sha256');

const Sequelize = require('sequelize');
const { Op } = Sequelize;

module.exports = class {
  constructor() {
    this.Contact = sequelize.get().models.Contact;
    this.ContactEvent = sequelize.get().models.ContactEvent;
    this.ContactEvents = sequelize.get().models.ContactEvents;

    this.contactService = new ContactService();
    this.blacklistedContactService = new BlacklistedContactService();
    this.contactComplaintScoreService = new ContactComplaintScoreService();

    this._contact_max_days_to_activate = null;
    this._contact_max_requests_to_activate = null;
    this._contact_max_inactive_days = null;
    this._contact_max_inactive_requests = null;
    this._contact_max_inactive_requests_for_non_activated_contacts = null;

    this._contact_max_noclick_days = null;
    this._contact_max_noclick_requests = null;

    this._contact_days_in_archive = null;
    this._contact_max_captcha_without_validation = null;
    this._contact_max_captacha_validation_ratio = null;
    this._contact_calculate_complaint_score = null;

    this._contact_proxy_loaded_weight = null;
    this._contact_open_weight = null;
    this._contact_click_weight = null;
    this._disable_old_contact_score = null;
  }

  _get_settings = async () => {
    var settingsLabels = [
      'contact_max_days_to_activate',
      'contact_max_requests_to_activate',
      'contact_max_inactive_days',
      'contact_max_inactive_requests',
      'contact_days_in_archive',
      'contact_max_inactive_requests_for_non_activated_contacts',
      'contact_max_noclick_days',
      'contact_max_noclick_requests',
      'contact_max_captcha_without_validation',
      'contact_max_captacha_validation_ratio',
      'contact_calculate_complaint_score',
      'contact_proxy_loaded_weight',
      'contact_open_weight',
      'contact_click_weight',
      'disable_old_contact_score'
    ];
    let settings = await getCachedSettings(settingsLabels);
    settingsLabels.map((setting) => (this['_' + setting] = settings[setting]));
  };

  _get_status_settings = async () => {
    if (this._contact_max_days_to_activate === null) {
      await this._get_settings();
    }
    return {
      contact_max_days_to_activate: this._contact_max_days_to_activate,
      contact_max_requests_to_activate: this._contact_max_requests_to_activate,
      contact_max_inactive_days: this._contact_max_inactive_days,
      contact_max_inactive_requests: this._contact_max_inactive_requests,
      contact_days_in_archive: this._contact_days_in_archive,
      contact_max_inactive_requests_for_non_activated_contacts: this._contact_max_inactive_requests_for_non_activated_contacts,
      contact_max_noclick_days: this._contact_max_noclick_days,
      contact_max_noclick_requests: this._contact_max_noclick_requests,
      contact_max_captcha_without_validation: this._contact_max_captcha_without_validation,
      contact_max_captacha_validation_ratio: this._contact_max_captacha_validation_ratio,
      contact_calculate_complaint_score: this._contact_calculate_complaint_score,
      contact_proxy_loaded_weight: this._contact_proxy_loaded_weight,
      contact_open_weight: this._contact_open_weight,
      contact_click_weight: this._contact_click_weight,
      disable_old_contact_score: this._disable_old_contact_score
    };
  };

  updateContactStatusWithId = async (contactId) => {
    let contact = await this.Contact.findByPk(contactId);
    if (contact) {
      return await this.updateContactStatus(contact);
    } else {
      log.warn(`Contact ${contactId} doesn't exists any more`);
    }
  };

  _getContactEvents = async (contact, inscriptions) => {
    let cachedEvents = await contact.getCachedEvents();
    if (!cachedEvents) {
      cachedEvents = await this.ContactEvents.create({
        contactId: contact.id,
        events: [],
        lastImportedId: null,
        lastImportedDate: null
      });
    }
    cachedEvents.events = cachedEvents.events.map((event) => {
      event.date = new Date(event.date);
      event.requestDate = new Date(event.requestDate);
      return event;
    });
    let where = {};
    if (!cachedEvents.lastImportedDate && cachedEvents.events?.length > 0) {
      cachedEvents.lastImportedDate = cachedEvents.events[0].date;
    }
    if (cachedEvents.lastImportedDate) {
      where.date = {
        [Op.gt]: cachedEvents.lastImportedDate
      };
    } else if (cachedEvents.lastImportedId && process.env.CONTACT_EVENTS_IGNORE_LAST_IMPORTED_ID !== 'true') {
      // CONTACT_EVENTS_IGNORE_LAST_IMPORTED_ID=true : ne pas filtrer sur l'identifiant du dernier événement importé
      // (en v1 ce comportement était câblé sur une base précise)
      where.id = {
        [Op.gt]: cachedEvents.lastImportedId
      };
    }
    let newEvents = await contact.getEvents({
      order: [['date', 'ASC']],
      where
    });

    if (newEvents && newEvents.length > 0) {
      for (let event of newEvents) {
        //on vérifie qu'il n'est pas déjà présent
        cachedEvents.lastImportedDate = event.date;
        cachedEvents.lastImportedId = event.id;
        if (cachedEvents.events.find((e) => e.id == event.id)) {
          continue;
        }
        if (event.type !== EventType.delivered) {
          cachedEvents.events.push(event);
        }

        if (event.type === EventType.soft_bounce) {
          if (event.details && event.details.bounceSubType == 'ContentRejected') {
            //le bounce ne concerne pas le contact, mais le contenu, inutile de le compter dans stats de bounce de ce contact.
            continue;
          }
        }

        //we update stats of contact
        if (!contact.stats) {
          contact.stats = {};
        }
        if (!(event.type in contact.stats)) {
          contact.stats[event.type] = 0;
        }
        contact.stats[event.type]++;

        if (event.isUnique) {
          if (!('unique_' + event.type in contact.stats)) {
            contact.stats['unique_' + event.type] = 0;
          }
          contact.stats['unique_' + event.type]++;
        }

        contact.changed('stats', true);

        //we update stats of inscription
        let inscription = this._getInscriptionOfEvent(inscriptions, event);
        if (inscription) {
          if (!inscription.stats) {
            inscription.stats = {};
          }
          if (!(event.type in inscription.stats)) {
            inscription.stats[event.type] = 0;
          }
          inscription.stats[event.type]++;
          if (event.isUnique) {
            if (!('unique_' + event.type in inscription.stats)) {
              inscription.stats['unique_' + event.type] = 0;
            }
            inscription.stats['unique_' + event.type]++;
          }
          inscription.changed('stats', true);
        }
      }
      cachedEvents.events = cachedEvents.events.sort((a, b) => {
        return a.date > b.date ? -1 : 1;
      });

      cachedEvents.changed('events', true);
    }

    //on ne garde que les events utiles pour mettre à jour le statut et le score
    //note : on ne peut pas encore faire ça, car les stats de contacts et d'inscription seraient fausses
    //max_inactive_days
    let { contact_max_inactive_days } = await this._get_status_settings();
    let minDate = moment()
      .add(-1 * Math.max(contact_max_inactive_days, 90), 'days')
      .toDate();
    cachedEvents.events = cachedEvents.events.filter((event) => {
      if (event.date >= minDate) {
        return true;
      }
      if ([EventType.unsub, EventType.hard_bounce, EventType.complaint].indexOf(event.type) >= 0) {
        cachedEvents.changed('events', true);
        return true;
      }
      return false;
    });

    if (cachedEvents.events.length > 5000) {
      cachedEvents.events = cachedEvents.events.slice(0, 5000);
      cachedEvents.changed('events', true);
    }

    await cachedEvents.save();

    return cachedEvents.events;
  };

  updateContactStatus = async (contact) => {
    log.debug(`Update status of contact ${contact.email}`);

    let inscriptions = await contact.getInscriptions({
      order: [['inscriptionDate', 'DESC']]
    });
    let events = null;
    try {
      events = await this._getContactEvents(contact, inscriptions);
    } catch (ex) {
      log.error(`Failed to get contact events ${contact.id}`, ex);
      return;
    }
    log.debug(`Found ${events.length} events and ${inscriptions.length} inscriptions  for contact ${contact.email}`);

    contact.esp = extractEsp(contact.email);
    if (!contact.md5) {
      contact.md5 = md5(contact.email);
      contact.sha1 = sha1(contact.email);
      contact.sha256 = sha256(contact.email);
    }

    await this._update_activation(contact, events, inscriptions);
    await this._update_status(contact, events, inscriptions);
    await this._update_scores(contact, events, inscriptions);

    if (contact.status == ContactStatus.removed) {
      await this.contactService.removeContact(contact.id);
      return null;
    } else {
      if (contact.status == ContactStatus.workable || contact.status == ContactStatus.new) {
        let lastInscription = inscriptions.length > 0 ? inscriptions[0] : null;
        if (lastInscription && moment().diff(moment(lastInscription.inscriptionDate), 'days') <= 0) {
          contact.nextStatusUpdateDate = moment().add(6, 'hours').toDate();
        } else {
          contact.nextStatusUpdateDate = moment().add(1, 'days').toDate();
        }
      } else {
        contact.nextStatusUpdateDate = moment().add(15, 'days').toDate();
      }
      contact.statusQueued = false;

      await contact.save();
      for (let inscription of inscriptions) {
        await inscription.save();
      }
      return contact;
    }
  };

  _update_scores = async (contact, events, inscriptions) => {
    let { contact_proxy_loaded_weight, contact_open_weight, contact_click_weight, disable_old_contact_score } = await this._get_status_settings();

    if (contact.status != ContactStatus.workable && contact.status != ContactStatus.new) {
      contact.customScores = {};
      contact.activityScore = 0;
    } else {
      contact.activityScore = 50;

      if (contact.pixelTrackingConsent === false) {
        //sans pixel tracking, pas de scoring d'engagement possible :
        //on garde un score neutre (cadence par défaut) tant que le contact est envoyable
        if (!contact.customScores) {
          contact.customScores = {};
        }
        contact.changed('customScores', true);
        return;
      }

      const now = moment().endOf('day');

      const weeks = {};
      var weightFactor = 1.7;
      let weeksCount = 8;
      let firstInscriptionDate = inscriptions.length ? inscriptions[inscriptions.length - 1].inscriptionDate : null;
      let lastInscriptionDate = inscriptions.length ? inscriptions[0].inscriptionDate : null;
      for (let i = 0; i < weeksCount; i++) {
        weeks[i] = {
          week: i,
          request: 0,
          open: 0,
          proxy_loaded: 0,
          click: 0,
          complaint: 0,
          unsub: 0,
          soft_bounce: 0,
          contact_bounce: 0,
          weight: Math.pow(weightFactor, weeksCount - i)
        };
      }
      for (let event of events) {
        let weekNo = now.diff(event.date, 'weeks');
        if (weekNo < weeksCount) {
          let week = weeks[weekNo];
          switch (event.type) {
            case EventType.request:
              week.request++;
              break;
            case EventType.open:
              if (event.isUnique) {
                week.open++;
              }
              break;
            case EventType.proxy_loaded:
              week.proxy_loaded++;
              break;
            case EventType.click:
              if (event.isUnique) {
                week.click++;
              }
              break;
            case EventType.complaint:
              week.complaint++;
              break;
            case EventType.unsub:
              week.unsub++;
              break;
            case EventType.soft_bounce:
              if (!event.details || event.details.bounceSubType != 'ContentRejected') {
                week.soft_bounce++;
              }
              break;
            case EventType.contact_bounce:
              week.contact_bounce++;
              break;
            default:
              break;
          }
        }
      }
      let minOpenRatio = 1 / 6;
      let lastWeekWithStats = null;

      let getRatio = (stats) => {
        return (
          -1 * (stats.soft_bounce ? stats.soft_bounce : 0) +
          -50 * (stats.contact_bounce ? stats.contact_bounce : 0) +
          -100 * (stats.unsub ? stats.unsub : 0) +
          -200 * (stats.complaint ? stats.complaint : 0) +
          -1 * stats.request +
          ((stats.open ? stats.open : 0) * contact_open_weight + (stats.proxy_loaded ? stats.proxy_loaded : 0) * contact_proxy_loaded_weight + (stats.click ? stats.click : 0) * contact_click_weight) /
            minOpenRatio
        );
      };

      let sigmoid = (x, λ) => {
        return 1 / (1 + Math.pow(Math.E, -1 * λ * x));
      };

      for (let i = weeksCount - 1; i >= 0; i--) {
        let week = weeks[i];
        if (week.complaint || week.unsub) {
          week.score = 0;
          continue;
        }

        var ratio = 0;
        if (firstInscriptionDate && week.week > now.diff(firstInscriptionDate, 'weeks')) {
          //le contact n'était pas encore inscrit

          //we take total stats
          let stats = contact.stats;
          if (!stats || !stats.request) {
            continue;
          }

          if (!contact.activated) {
            ratio = getRatio(stats);
            //ratio *= (1 + (week.week - now.diff(firstInscriptionDate, 'weeks')) / (weeksCount - now.diff(firstInscriptionDate, 'weeks')));
            //on ne décompte que les ratios négatifs.
            ratio = Math.min(0, ratio);
          } else {
            ratio = 0;
          }
        } else {
          if (disable_old_contact_score) {
            ratio = getRatio(week);
          } else {
            //Toute cette partie a été rajoutée après, et j'ai l'impression que c'est ça qui peut pénaliser l'activation sur gmail
            if (week.request) {
              lastWeekWithStats = week;
              ratio = getRatio(week);
            } else if (lastWeekWithStats) {
              //on prend les dernières stats, qu'on diminue un peu, car l'absense de requete diminue légèrement la chance qu'il réouvre un jour
              ratio = getRatio(lastWeekWithStats);
              ratio -= (lastWeekWithStats.week - i) * 10;
              if (lastWeekWithStats.complaint) {
                week.score = 0;
                continue;
              }
            } else {
              //le contact était inscrit il y a longtemps. On prend ses anciennes stats
              let stats = contact.stats;
              if (stats && stats.complaint) {
                week.score = 0;
                continue;
              }
              if (stats && stats.request) {
                ratio = getRatio(stats) - now.diff(lastInscriptionDate, 'days') * 0.3;
              }
            }
          }
        }

        let sigmoidValue = sigmoid(ratio, minOpenRatio);

        let score = week.weight * sigmoidValue;

        week.score = Math.min(week.weight, Math.max(0, score));
      }

      let totalWeight = 0;
      let activityScore = 0;
      for (var i in weeks) {
        if ('score' in weeks[i]) {
          activityScore += weeks[i].score;
          totalWeight += weeks[i].weight;
        } else {
          activityScore += weeks[i].weight / 2;
          totalWeight += weeks[i].weight;
        }
      }

      activityScore = Math.round((100 * activityScore * 100) / totalWeight) / 100;
      if (contact.status == ContactStatus.new) {
        let lastInscription = inscriptions.length > 0 ? inscriptions[0] : null;
        if (lastInscription) {
          let hoursSinceLastInscription = moment().diff(moment(lastInscription.inscriptionDate), 'hours');
          activityScore -= hoursSinceLastInscription / (24 * 5.0);
        }

        activityScore = Math.max(0, activityScore);
      }
      if (activityScore > 1) {
        activityScore -= Math.random();
      } else {
        activityScore -= Math.random() / activityScore;
      }
      activityScore = Math.round(100 * activityScore) / 100;
      activityScore = Math.max(0, activityScore);
      contact.activityScore = activityScore;
      log.debug(`Score calculated is ${activityScore}`);

      if (!contact.customScores) {
        contact.customScores = {};
      }
      contact.customScores.clickQualityScore = this.getClickQualityScore(contact, events);
      let { contact_calculate_complaint_score } = await this._get_status_settings();
      if (contact_calculate_complaint_score) {
        try {
          contact.customScores.complaintRiskScore = Math.round(100000 * (await this.contactComplaintScoreService.getProbaComplaint(contact, events))) / 1000;
        } catch (err) {
          log.error(`Cannot compute complaint score for ${contact.id}`, err);
        }
      }
      contact.changed('customScores', true);
    }
  };

  getClickQualityScore = (contact, events) => {
    let nonValidatedCaptchaMalusScore = this._getNonValidatedCaptchaMalusScore(contact.stats);
    let clickRatioMalusScore = this._getClickRatioMalusScore(contact.stats);
    let clickDelayMalusScore = this._getclickDelayMalusScore(events);
    let noClickFactor = this._getNoClickFactor(contact.stats);
    return noClickFactor * (100 - 0.6 * nonValidatedCaptchaMalusScore - 0.2 * clickRatioMalusScore - 0.2 * clickDelayMalusScore);
  };

  _getclickDelayMalusScore = (events) => {
    let newEvents = events?.filter((event) => event.type === 'click');
    if (!newEvents?.length) {
      return 0;
    }
    let eventsDelayInMinutes = newEvents.map((event) => moment(event.date).diff(moment(event.requestDate), 'minutes'));
    let averageDelayInMinutes = eventsDelayInMinutes.reduce((a, b) => a + b, 0) / eventsDelayInMinutes.length;

    if (averageDelayInMinutes > 5) {
      return 0;
    } else {
      return (100 * (5 - averageDelayInMinutes)) / 5;
    }
  };

  _getNoClickFactor = (stats) => {
    //1 if OK, 0.75 if no click

    if (!stats?.request) {
      return 1;
    }
    if (!stats?.click) {
      return 0.75;
    } else if (stats?.click === 1 && stats?.request > 20) {
      return 0.9;
    }
    return 1;
  };

  _getNonValidatedCaptchaMalusScore = (stats) => {
    //0 if OK, 100 if all captcha asked not validated and big volume

    if (!stats?.request || !stats.click_validation_asked) {
      return 0;
    }
    let asked = stats.click_validation_asked;
    let checked = stats.click_validation_checked ?? 0;
    let maxMalus = Math.min(20 * asked, 100);
    let captchaValidationRation = checked / asked;
    return maxMalus * (1 - captchaValidationRation);
  };

  _getClickRatioMalusScore = (stats) => {
    //0 if OK, 100 if all requests have unique_click

    if (!stats?.request || stats?.request < 5) {
      return 0;
    }
    let unique_click = stats.unique_click ?? 0;
    let request = stats.request ?? 0;

    if (!unique_click || (unique_click == 1 && request < 20)) {
      return 0;
    }
    return (100 * unique_click) / request;
  };

  _clicksAreLegit = (stats, maxCaptchaWithoutAnyValidation, maxCaptchaValidationRatio) => {
    if (stats?.click_validation_asked) {
      let asked = stats.click_validation_asked;
      let checked = stats.click_validation_checked ?? 0;
      if (checked == 0 && asked >= maxCaptchaWithoutAnyValidation) {
        return false;
      }
      if (checked < asked * maxCaptchaValidationRatio) {
        return false;
      }
    }
    return true;
  };

  _update_status = async (contact, events, inscriptions) => {
    contact.blacklisted = (await this.blacklistedContactService.findWithFields(contact.email, contact.md5, contact.sha1, contact.sha256)) != null;
    let lastInscription = inscriptions.length > 0 ? inscriptions[0] : null;
    if (lastInscription) {
      let {
        contact_max_days_to_activate,
        contact_max_requests_to_activate,
        contact_max_inactive_days,
        contact_max_inactive_requests,
        contact_days_in_archive,
        contact_max_inactive_requests_for_non_activated_contacts,
        contact_max_noclick_days,
        contact_max_noclick_requests,
        contact_max_captcha_without_validation,
        contact_max_captacha_validation_ratio
      } = await this._get_status_settings();

      //sans pixel tracking, on ne reçoit plus d'ouvertures/clics : les règles
      //d'archivage basées sur l'inactivité ne sont pas applicables à ces contacts
      let trackingAllowed = contact.pixelTrackingConsent !== false;

      let unsubEvent = this._filter_first_event(events, lastInscription.inscriptionDate, [EventType.unsub]);
      let complaintEvent = this._filter_first_event(events, null, [EventType.complaint]);
      let hardBounceEvent = this._filter_first_event(events, null, [EventType.hard_bounce]);
      let lastActivityEvent = this._filter_first_event(events, null, [EventType.click, EventType.open, EventType.proxy_loaded]);
      let lastClickEvent = this._filter_first_event(events, null, [EventType.click]);
      let lastActivityDate = lastInscription.inscriptionDate;
      if (lastActivityEvent && lastActivityEvent.date > lastActivityDate) {
        lastActivityDate = lastActivityEvent.date;
      }
      let lastRealActivityDate = lastInscription.inscriptionDate;
      if (lastClickEvent && lastClickEvent.date > lastInscription.inscriptionDate) {
        lastRealActivityDate = lastClickEvent.date;
      }

      let request = this._filter_and_count_events(events, lastActivityEvent ? lastActivityEvent.date : null, [EventType.request]);
      let requestForActivation = this._filter_and_count_events(events, lastInscription.inscriptionDate, [EventType.request]);
      let noRealActivityRequests = this._filter_and_count_events(events, lastRealActivityDate, [EventType.request]);

      if (contact.email.indexOf('@cs.toolso.fr') > 0) {
        contact.status = ContactStatus.workable;
      } else if (hardBounceEvent) {
        contact.status = ContactStatus.hard_bounce;
      } else if (complaintEvent) {
        contact.status = ContactStatus.complaint;
      } else if (contact.blacklisted || contact.status == ContactStatus.blacklisted) {
        //il était déjà blacklisté, on le laisse blacklisté
        contact.status = ContactStatus.blacklisted;
      } else if (unsubEvent) {
        contact.status = ContactStatus.unsub;
      } else if (!contact.activated && moment().diff(moment(lastInscription.inscriptionDate), 'days') > contact_max_days_to_activate) {
        contact.status = ContactStatus.archived;
        contact.statusDetail = {
          reason: 'Contact reached max time to activate'
        };
      } else if (!contact.activated && request > contact_max_inactive_requests_for_non_activated_contacts) {
        contact.status = ContactStatus.archived;
        contact.statusDetail = {
          reason: 'Inactivated contact reached max request.'
        };
      } else if (!contact.activated && requestForActivation > contact_max_requests_to_activate) {
        contact.status = ContactStatus.archived;
        contact.statusDetail = {
          reason: 'Contact reached max request to activate'
        };
      } else if (trackingAllowed && request > contact_max_inactive_requests) {
        contact.status = ContactStatus.archived;
        contact.statusDetail = {
          reason: 'Contact reached max inactive request'
        };
      } else if (trackingAllowed && noRealActivityRequests > contact_max_noclick_requests) {
        contact.status = ContactStatus.archived;
        contact.statusDetail = {
          reason: 'Contact reached max noclick requests'
        };
      } else if (trackingAllowed && lastRealActivityDate && moment().diff(moment(lastRealActivityDate), 'days') > contact_max_noclick_days) {
        contact.status = ContactStatus.archived;
        contact.statusDetail = {
          reason: 'Contact reached max noclick days'
        };
      } else if (trackingAllowed && lastActivityDate && moment().diff(moment(lastActivityDate), 'days') > contact_max_inactive_days) {
        contact.status = ContactStatus.archived;
        contact.statusDetail = {
          reason: 'Contact reached max inactive days'
        };
      } else if (contact.stats && contact.stats.request > 10 && contact.stats.click >= contact.stats.request) {
        contact.status = ContactStatus.blacklisted;
        contact.statusDetail = {
          reason: 'Contact produced too much clicks. We blacklist it.'
        };
      } else if (contact.stats?.request && !this._clicksAreLegit(contact.stats, contact_max_captcha_without_validation, contact_max_captacha_validation_ratio)) {
        contact.status = ContactStatus.blacklisted;
        contact.statusDetail = {
          reason: 'Clicks are not validated.'
        };
      } else if (contact.stats?.contact_bounce && contact.stats?.contact_bounce > 5) {
        contact.status = ContactStatus.archived;
        contact.statusDetail = {
          reason: 'Too much contact bounce.'
        };
      } else {
        contact.status = contact.activated ? ContactStatus.workable : ContactStatus.new;
        contact.lastWorkableStatusDate = new Date();
      }

      if (
        contact.status != ContactStatus.workable &&
        contact.status != ContactStatus.new &&
        (!contact.lastWorkableStatusDate || moment().diff(moment(contact.lastWorkableStatusDate), 'days') >= contact_days_in_archive)
      ) {
        log.warn(`Contact ${contact.email} is ${contact.status} since to many days . We delete it.`);
        contact.status = ContactStatus.removed;
      }
    } else {
      log.warn(`Contact ${contact.email} has no inscription. We can't calculate status for it. We delete it.`);
      contact.status = ContactStatus.removed;
    }
  };

  _update_activation = async (contact, events, inscriptions) => {
    if (contact.pixelTrackingConsent === false) {
      //sans pixel tracking, impossible de détecter l'activation via les ouvertures/clics :
      //l'inscription devient active dès qu'un email est parti (les bounces/unsub sont gérés dans _update_status)
      let contactHasActivatedInscription = false;
      for (let inscription of inscriptions) {
        let hasRequest = events.some((event) => event.type === EventType.request && event.date >= inscription.inscriptionDate);
        inscription.activated = inscription.activated || hasRequest;
        if (inscription.activated) {
          contactHasActivatedInscription = true;
        }
      }
      contact.activated = contactHasActivatedInscription;
      return;
    }
    let contactActivated = false;
    let eventIndex = 0;
    let minInscriptionDate = moment().add(-60, 'days').toDate();
    for (let inscription of inscriptions) {
      if (inscription.inscriptionDate <= minInscriptionDate) {
        //ça ne sert à rien de mettre ce statut à jour si c'est trop vieux
        if (inscription.activated) {
          contactActivated = true;
        }
        continue;
      }
      let lastUnsubTs = null;
      let lastActivatedTs = null;
      let inscriptionActivated = false;
      while (eventIndex < events.length && events[eventIndex].date >= inscription.inscriptionDate) {
        let event = events[eventIndex];
        if ([EventType.unsub, EventType.complaint, EventType.hard_bounce].includes(event.type)) {
          lastUnsubTs = event.date.getTime();
          if (!lastActivatedTs || lastActivatedTs - lastUnsubTs <= 24 * 3600000) {
            inscriptionActivated = false;
          }
        } else if ([EventType.open, EventType.click, EventType.proxy_loaded].includes(event.type)) {
          if ((!inscriptionActivated && !lastUnsubTs) || lastUnsubTs - event.date.getTime() >= 24 * 3600000) {
            inscriptionActivated = true;
            lastActivatedTs = event.date.getTime();
          }
        }
        eventIndex++;
      }
      if (inscriptionActivated) {
        contactActivated = true;
      }
      inscription.activated = inscriptionActivated || (inscription.nextInscriptionToday && inscription.nextInscriptionToday.activated);
      if (!inscription.isFirstToday) {
        let todayInscriptions = await this._getInscriptionsOfSameDayBefore(inscriptions, inscription);
        if (todayInscriptions.length) {
          if (inscription.activated) {
            for (let item of todayInscriptions) {
              item.activated = true;
            }
          }
          todayInscriptions[todayInscriptions.length - 1].isFirstToday = true;
        } else {
          inscription.isFirstToday = true;
        }
      }
    }
    contact.activated = contactActivated;
  };

  _getInscriptionsOfSameDayBefore = async (inscriptions, inscription) => {
    let index = inscriptions.indexOf(inscription);
    index++;
    let result = [];
    let timezone = (await getCachedSettings(['timezone'])).timezone;
    let nextInscriptionToday = inscription;
    while (index < inscriptions.length) {
      let item = inscriptions[index];
      item.nextInscriptionToday = nextInscriptionToday;
      if (moment(item.inscriptionDate).tz(timezone) >= moment(inscription.inscriptionDate).tz(timezone).startOf('day')) {
        result.push(item);
      } else {
        break;
      }
      index++;
      nextInscriptionToday = item;
    }
    return result;
  };
  _getInscriptionOfEvent = (inscriptions, event) => {
    let inscriptionFound = null;
    for (let inscription of inscriptions) {
      if (inscription.inscriptionDate <= event.date) {
        inscriptionFound = inscription;
        break;
      }
    }
    return inscriptionFound;
  };

  _filter_first_event(events, minDate, types) {
    for (let event of events) {
      if (minDate && event.date < minDate) {
        return null;
      }
      if (types && types.includes(event.type)) {
        return event;
      }
      if (!types) {
        return event;
      }
    }
    return null;
  }
  _filter_and_count_events(events, minDate, types) {
    let count = 0;
    for (let event of events) {
      if (minDate && event.date < minDate) {
        return count;
      }
      if (types && types.includes(event.type)) {
        count++;
      }
      if (!types) {
        count++;
      }
    }
    return count;
  }
};
