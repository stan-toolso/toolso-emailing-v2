const log = require('../util/log').getLogger('ContactComplaintScoreService');
const moment = require('moment-timezone');
const { getCachedSettings } = require('./SettingsService');
const fetch = require('../infra/getNodeFetch')();
const config = require('../util/config');

module.exports = class {
  constructor() {}

  getProbaComplaint = async (contact, events) => {
    let timezone = (await getCachedSettings(['timezone'])).timezone;
    let countryCode = (await getCachedSettings(['countryCode'])).countryCode ?? 'FR';
    let event1Days = events.filter((event) => moment().diff(moment.tz(event.createdAt, timezone), 'days') < 1);
    let event3Days = events.filter((event) => moment().diff(moment.tz(event.createdAt, timezone), 'days') < 3);
    let event5Days = events.filter((event) => moment().diff(moment.tz(event.createdAt, timezone), 'days') < 5);
    let lastInscription = await contact.getLastInscription();
    let nbDaysSinceCreation = moment().diff(moment.tz(contact.createdAt, timezone), 'days');

    let scorerParams = {
      database: process.env.RESOURCE_UID,
      email: contact.email,
      firstname: contact.firstname,
      lastname: contact.lastname,
      gender: contact.gender,
      age: contact.dob ? moment().diff(moment(contact.dob), 'years') : null,
      zipcode: contact.zipcode,
      city: contact.city,
      esp: contact.esp,
      activity_score_av_day_before: contact.activityScore,
      nbr_days_since_inscri: moment().diff(moment.tz(lastInscription?.inscriptionDate ?? contact.createdAt, timezone), 'days'),
      delivered_total: contact.stats?.delivered ?? 0,
      open_total: contact.stats?.open ?? 0,
      click_total: contact.stats?.click ?? 0,
      proxy_total: contact.stats?.proxy_loaded ?? 0,
      delivered_3_last_days: event3Days?.filter((event) => event.type == 'delivered')?.length ?? 0,
      open_3_last_days: event3Days?.filter((event) => event.type == 'open')?.length ?? 0,
      click_3_last_days: event3Days?.filter((event) => event.type == 'click')?.length ?? 0,
      proxy_3_last_days: event3Days?.filter((event) => event.type == 'proxy_loaded')?.length ?? 0,
      delivered_5_last_days: event5Days?.filter((event) => event.type == 'delivered')?.length ?? 0,
      open_5_last_days: event5Days?.filter((event) => event.type == 'open')?.length ?? 0,
      click_5_last_days: event5Days?.filter((event) => event.type == 'click')?.length ?? 0,
      proxy_5_last_days: event5Days?.filter((event) => event.type == 'proxy_loaded')?.length ?? 0,
      mean_open_2_last_days: nbDaysSinceCreation >= 2 ? this.getMeanOpenDuringLastDays(events, timezone, 2) : NaN,
      mean_open_4_last_days: nbDaysSinceCreation >= 4 ? this.getMeanOpenDuringLastDays(events, timezone, 4) : NaN,
      mean_open_8_last_days: nbDaysSinceCreation >= 8 ? this.getMeanOpenDuringLastDays(events, timezone, 8) : NaN,
      delivered_day_before: event1Days?.filter((event) => event.type == 'delivered')?.length ?? 0,
      open_day_before: event1Days?.filter((event) => event.type == 'open')?.length ?? 0,
      click_day_before: event1Days?.filter((event) => event.type == 'click')?.length ?? 0,
      proxy_day_before: event1Days?.filter((event) => event.type == 'proxy_loaded')?.length ?? 0,
      year_of_birth: contact.dob ? moment(contact.dob).year() : null,
      year_insci: contact.createdAt ? moment(contact.createdAt).year() : null,
      target: 0, //used by model
      country: countryCode
    };

    // v1 : Lambda `complaintScorer` (compte AWS tiers). v2 : service HTTP optionnel (`COMPLAINT_SCORER_URL`,
    // POST JSON des mêmes paramètres, réponse `{ complaintProbability }`). Sans URL, le score reste indéfini,
    // comme en v1 lorsque l'appel échouait.
    const scorerUrl = config.complaintScorerUrl();
    if (!scorerUrl) {
      log.debug('COMPLAINT_SCORER_URL not configured: complaint probability is undefined');
      return undefined;
    }
    try {
      log.debug(`Call complaint scorer with params ${JSON.stringify(scorerParams)}`);
      let response = await fetch(scorerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(scorerParams)
      });
      let data = await response.json();
      return data?.complaintProbability;
    } catch (err) {
      log.error('Failed to call model', err);
    }
  };

  getMeanOpenDuringLastDays(events, timezone, nbdays) {
    if (!events) {
      return 0;
    }
    let filteredEvents = events.filter((event) => moment().diff(moment.tz(event.createdAt, timezone), 'days') < nbdays && event.type === 'open');
    return filteredEvents ? filteredEvents.length / nbdays : 0;
  }
};
