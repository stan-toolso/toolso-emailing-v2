const log = require('../../util/log').getLogger('SES Webhook');
const ActionService = require('../../services/ActionService');
const ActionType = require('../../services/ActionType');
const EventType = require('../../storage/models/EventType');
var moment = require('moment-timezone');
var CryptoJS = require('crypto-js');
const simpleParser = require('mailparser').simpleParser;
const extractEmail = require('extract-email-address').default;
const config = require('../../util/config');

let _actionService = null;
const getActionService = async () => {
  if (_actionService) {
    return _actionService;
  } else {
    _actionService = new ActionService();
    return _actionService;
  }
};

/**
 * Webhooks des fournisseurs d'envoi (ex-Lambda `ses_webhook`, chemins /ses, /sib, /toolso).
 * @param {'ses'|'sib'|'toolso'} router
 * @param {string|object} body corps brut (string JSON) ou déjà parsé
 */
const handleWebhook = async (router, body) => {
  const event = { body: typeof body === 'string' ? body : JSON.stringify(body) };
  log.debug(`Receive new ${router} event ${event.body}`);
  switch (router) {
    case 'toolso':
      return await handleToolsoEvent(event);
    case 'sib':
      return await handleSibEvent(event);
    default:
    case 'ses':
      return await handleSesEvent(event);
  }
};

/**
 * Enveloppe SNS (abonnement HTTPS à un topic qui reçoit les événements d'un configuration set SES) :
 * - SubscriptionConfirmation : confirmée en appelant SubscribeURL (hôte sns.<région>.amazonaws.com seulement) ;
 * - Notification (livraison non « raw ») : l'événement SES est dans Message.
 * Renvoie { done: réponse } si le message SNS est traité ici, sinon { event } (événement SES à traiter).
 */
const SNS_HOST = /^sns\.[a-z0-9-]+\.amazonaws\.com(\.cn)?$/;
const unwrapSns = async (event) => {
  if (!event || typeof event.Type !== 'string') {
    return { event };
  }
  if (event.Type === 'SubscriptionConfirmation' || event.Type === 'UnsubscribeConfirmation') {
    let url;
    try {
      url = new URL(event.SubscribeURL);
    } catch (e) {
      url = null;
    }
    if (event.Type === 'UnsubscribeConfirmation' || !url || url.protocol !== 'https:' || !SNS_HOST.test(url.hostname)) {
      log.warn(`SNS ${event.Type} ignoré (topic ${event.TopicArn}, URL ${event.SubscribeURL})`);
      return { done: 'Ignored' };
    }
    const res = await fetch(url.toString());
    log.info(`Abonnement SNS confirmé pour ${event.TopicArn} (HTTP ${res.status})`);
    return { done: res.ok ? 'Subscribed' : 'Subscription failed' };
  }
  if (event.Type === 'Notification' && typeof event.Message === 'string') {
    try {
      return { event: JSON.parse(event.Message) };
    } catch (e) {
      log.warn(`Notification SNS illisible (topic ${event.TopicArn})`);
      return { done: 'Invalid message' };
    }
  }
  return { event };
};

const handleSesEvent = async (event) => {
  event = JSON.parse(event.body);
  const sns = await unwrapSns(event);
  if (sns.done) {
    return sns.done;
  }
  event = sns.event;
  if (event && event.notificationType && event.notificationType == 'Received') {
    return await handleMessage(event);
  }

  if (!event || !event.mail || !event.mail.destination) {
    log.debug(`No event`);
    log.debug(JSON.stringify(event));
    return 'No event';
  }
  if (event.eventType == 'Send' || event.eventType == 'Open' || event.eventType == 'Click') {
    log.debug(`${event.eventType} event. Just return OK`);
    return 'OK';
  }

  let eventType = {
    Delivery: EventType.delivered,
    //Open: EventType.open,
    //Click: EventType.click,
    Complaint: EventType.complaint
  }[event.eventType];
  if (!eventType && event.eventType == 'Bounce') {
    if (event.bounce.bounceType == 'Permanent') {
      eventType = EventType.hard_bounce;
    } else if (event.bounce.bounceType == 'Transient' && event.bounce.bounceSubType == 'MailboxFull') {
      eventType = EventType.contact_bounce;
    } else if (event.bounce.bounceType == 'Transient') {
      if (event.bounce.bounceSubType && event.bounce.bounceSubType == 'ContentRejected') {
        eventType = EventType.content_bounce;
      } else {
        eventType = EventType.soft_bounce;
      }
    }
  }

  if (eventType) {
    let date = moment.utc(event.mail.timestamp).toDate();
    if (event.click && event.click.timestamp) {
      date = moment.utc(event.click.timestamp).toDate();
    } else if (event.open && event.open.timestamp) {
      date = moment.utc(event.open.timestamp).toDate();
    } else if (event.delivery && event.delivery.timestamp) {
      date = moment.utc(event.delivery.timestamp).toDate();
    } else if (event.complaint && event.complaint.timestamp) {
      date = moment.utc(event.complaint.timestamp).toDate();
    }

    let details = null;
    if (event.open) {
      details = {
        ts: moment.utc(event.open.timestamp).toDate(),
        userAgent: event.open.userAgent,
        ip: event.open.ipAddress
      };

      if (details.userAgent == 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.246 Mozilla/5.0') {
        // && (details.ip.indexOf('66.249') === 0  || details.ip.indexOf('172.70') === 0  || details.ip.indexOf('72.14') === 0 || details.ip.indexOf('209.85') === 0)) {
        //it's google bot

        log.debug(`Google bot detected.`);
        return 'OK';
      }
      if (details.userAgent == 'Mozilla/5.0') {
        eventType = EventType.proxy_loaded;
      } else if ((details.userAgent && details.userAgent.indexOf('Sendinblue/1.0')) || ['91.173.102.254', '185.107.232.9'].includes(details.ip)) {
        //it's sendinblue proxy. On ne sauvegarde pas cet event.
        return 'OK';
      }
    } else if (event.click) {
      let link = event.click.link;
      link = untrackLink(link);
      if (link && link.indexOf('/unsub/') >= 0) {
        log.debug(`${link} is an unsub link. We can ignore this event.`);
        return 'OK';
      }
      if (config.isMirrorLink(link)) {
        log.debug(`${link} is a mirror link. We can ignore this event.`);
        return 'OK';
      }

      details = {
        ts: moment.utc(event.click.timestamp).toDate(),
        userAgent: event.click.userAgent,
        ip: event.click.ipAddress,
        link
      };
    } else if (event.bounce) {
      details = {
        ts: moment.utc(event.bounce.timestamp).toDate(),
        log: event.bounce,
        bounceSubType: event.bounce.bounceSubType
      };
    } else if (event.complaint) {
      details = {
        ts: moment.utc(event.complaint.timestamp).toDate(),
        userAgent: event.complaint.userAgent,
        complainedRecipients: event.complaint.complainedRecipients,
        complaintFeedbackType: event.complaint.complaintFeedbackType,
        feedbackId: event.complaint.feedbackId
      };
    }

    let ip = null;
    if (event.mail.tags && 'ses:outgoing-ip' in event.mail.tags) {
      ip = event.mail.tags['ses:outgoing-ip'].length > 0 ? event.mail.tags['ses:outgoing-ip'][0] : null;
    }

    for (let destination of event.mail.destination) {
      let payload = {
        email: destination,
        eventType: eventType,
        ts: date.getTime(),
        messageId: event.mail.messageId,
        details,
        ip: ip
      };
      log.debug(`New Action generated : ${JSON.stringify(payload)}`);
      await (await getActionService()).newAction(ActionType.insert_contact_event, payload);
    }
  } else {
    log.warn(`${event.eventType} seems not supported`);
  }

  return 'OK';
};

/**
 * Événements natifs du greffon Haraka des routeurs Toolso (router/toolso-app.js de toolso-media), postés tels quels sur
 * details.webhookEndpoint (en plus de SQS côté media) :
 *   { type: 'emailing_delivered', ts, mail: { ts, from, to, messageId } }
 *   { type: 'emailing_bounce', ts, mail: {...}, bounce: { error, message, details: [rcpt_to avec dsn_status, dsn_smtp_response, ...] } }
 * mail.messageId = uuid Haraka renvoyé par /sendRawEmail (« Message Queued (<uuid>) »), enregistré comme messageId à l'envoi.
 * Le classement des bounces reprend celui de media (backend/services/events/manageEmailingEvent.js) pour que les deux
 * bases restent comparables pendant la transition : par défaut soft, 5.1.1/5.1.2 et « Recipient address rejected » hard,
 * 5.2.2 boîte pleine (contact_bounce), faux hard bounces Orange/La Poste en soft.
 * Renvoie le payload insert_contact_event, ou null si l'événement n'est pas exploitable.
 */
const ORANGE_SOFT_CODES = ['OFR_506', 'OFR005_405'];
const ORANGE_SOFT_DSN = ['5.2.0', '5.1.0'];
const includesAny = (str, values) => typeof str === 'string' && values.some((v) => str.indexOf(v) >= 0);

const classifyHarakaBounce = (bounce) => {
  const rcpt = bounce && Array.isArray(bounce.details) ? bounce.details[0] : null;
  const rcptMessage = (rcpt && rcpt.message) || null;
  const dsn = (rcpt && rcpt.dsn_status) || null;
  const dsnResponse = (rcpt && rcpt.dsn_smtp_response) || null;
  const message = bounce && typeof bounce.message === 'string' ? bounce.message : null;

  // faux hard bounces (tous les MX en échec, Orange/La Poste) : soft
  if (includesAny(rcptMessage, ['Too many failures (Tried all MXs)']) || includesAny(message, ['Too many failures (Tried all MXs)'])) {
    return EventType.soft_bounce;
  }
  if (ORANGE_SOFT_DSN.includes(dsn) && (includesAny(rcptMessage, ORANGE_SOFT_CODES) || includesAny(dsnResponse, ORANGE_SOFT_CODES))) {
    return EventType.soft_bounce;
  }
  if (dsn) {
    switch (dsn) {
      case '5.1.1':
      case '5.1.2':
        return EventType.hard_bounce;
      case '5.2.2':
        return EventType.contact_bounce;
      default:
        return EventType.soft_bounce;
    }
  }
  if (includesAny(message, ['Recipient address rejected']) || includesAny(rcptMessage, ['Recipient address rejected'])) {
    return EventType.hard_bounce;
  }
  return EventType.soft_bounce;
};

const harakaEventToPayload = (event) => {
  if (!event || !event.mail || !event.mail.to || !event.mail.messageId) {
    return null;
  }
  const ts = event.ts || event.mail.ts || Date.now();
  if (event.type === 'emailing_delivered') {
    return { email: event.mail.to, eventType: EventType.delivered, ts, messageId: event.mail.messageId, details: { ts: new Date(ts) } };
  }
  if (event.type === 'emailing_bounce') {
    const eventType = classifyHarakaBounce(event.bounce);
    return {
      email: event.mail.to,
      eventType,
      ts,
      messageId: event.mail.messageId,
      details: { ts: new Date(ts), log: event.bounce, dsnStatus: event.bounce?.details?.[0]?.dsn_status || null }
    };
  }
  return null;
};

const handleHarakaEvent = async (event) => {
  const payload = harakaEventToPayload(event);
  if (!payload) {
    log.warn(`Toolso router event ${event.type} not supported or incomplete`);
    return 'OK';
  }
  log.debug(`New Action generated : ${JSON.stringify(payload)}`);
  await (await getActionService()).newAction(ActionType.insert_contact_event, payload);
  return 'OK';
};

const handleToolsoEvent = async (event) => {
  event = JSON.parse(event.body);
  if (event && typeof event.type === 'string' && event.type.indexOf('emailing_') === 0) {
    return await handleHarakaEvent(event);
  }
  if (event && event.notificationType && event.notificationType == 'Received') {
    return await handleMessage(event);
  }

  if (!event || !event.mail || !event.mail.to) {
    log.debug(`No event`);
    log.debug(JSON.stringify(event));
    return 'No event';
  }
  if (event.eventType == 'Send') {
    log.debug(`Send event`);
    return 'OK';
  }

  let eventType = {
    Delivery: EventType.delivered,
    Unsub: EventType.unsub,
    Open: EventType.open,
    Click: EventType.click,
    Complaint: EventType.complaint,
    ClickValidationAsked: EventType.click_validation_asked,
    ClickValidationChecked: EventType.click_validation_checked
  }[event.eventType];

  if (!eventType && event.eventType == 'Bounce') {
    if (event.bounce.bounceType == 'Permanent') {
      //on detecte les faux hard bounce
      if (event.bounce.rcpt_to_details?.message && event.bounce.rcpt_to_details.message.indexOf('Error: Too many failures (Tried all MXs)') >= 0) {
        eventType = EventType.soft_bounce;
      }
      //parfois orange renvoie des permanent alors que c'est un soft bounce
      else if (
        event.bounce.bounceSubType == 'NoEmail' &&
        event.bounce.rcpt_to_details &&
        ((event.bounce.rcpt_to_details.dsn_status == '5.2.0' && event.bounce.rcpt_to_details.message && event.bounce.rcpt_to_details.message.indexOf('OFR_506')) ||
          (event.bounce.rcpt_to_details.dsn_status == '5.1.0' && event.bounce.rcpt_to_details.message && event.bounce.rcpt_to_details.message.indexOf('OFR005_405')) ||
          (event.bounce.rcpt_to_details.dsn_status == '5.2.0' && event.bounce.rcpt_to_details.dsn_smtp_response && event.bounce.rcpt_to_details.dsn_smtp_response.indexOf('OFR_506')) ||
          (event.bounce.rcpt_to_details.dsn_status == '5.1.0' && event.bounce.rcpt_to_details.dsn_smtp_response && event.bounce.rcpt_to_details.dsn_smtp_response.indexOf('OFR005_405')))
      ) {
        eventType = EventType.soft_bounce;
      } else {
        eventType = EventType.hard_bounce;
      }
    } else if (event.bounce.bounceType == 'Transient' && event.bounce.bounceSubType == 'MailboxFull') {
      eventType = EventType.contact_bounce;
    } else if (event.bounce.bounceType == 'Transient') {
      if (event.bounce.bounceSubType && event.bounce.bounceSubType == 'ContentRejected') {
        eventType = EventType.content_bounce;
      } else {
        eventType = EventType.soft_bounce;
      }
    }
  }

  if (eventType) {
    let date = moment.utc(event.mail.timestamp).toDate();
    if (event.click && event.click.timestamp) {
      date = moment.utc(event.click.timestamp).toDate();
    } else if (event.open && event.open.timestamp) {
      date = moment.utc(event.open.timestamp).toDate();
    } else if (event.delivery && event.delivery.timestamp) {
      date = moment.utc(event.delivery.timestamp).toDate();
    } else if (event.complaint && event.complaint.timestamp) {
      date = moment.utc(event.complaint.timestamp).toDate();
    } else if (event.click_validation_asked && event.click_validation_asked.timestamp) {
      date = moment.utc(event.click_validation_asked.timestamp).toDate();
    } else if (event.click_validation_checked && event.click_validation_checked.timestamp) {
      date = moment.utc(event.click_validation_checked.timestamp).toDate();
    }

    let details = null;
    let ip = null;
    if (event.open) {
      details = {
        ts: moment.utc(event.open.timestamp).toDate(),
        userAgent: event.open.userAgent,
        ip: event.open.ipAddress
      };

      if (details.userAgent == 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.246 Mozilla/5.0') {
        // && (details.ip.indexOf('66.249') === 0  || details.ip.indexOf('172.70') === 0  || details.ip.indexOf('72.14') === 0 || details.ip.indexOf('209.85') === 0)) {
        //it's google bot

        log.debug(`Google bot detected.`);
        return 'OK';
      }

      if (details.userAgent == 'Mozilla/5.0') {
        eventType = EventType.proxy_loaded;
      }
      // else if (details.userAgent && details.userAgent.indexOf('Sendinblue/1.0') >= 0) {
      //   eventType = EventType.proxy_loaded;
      // } else if (['91.173.102.254', '185.107.232.9'].includes(details.ip)) {
      //   //seem's to be hotmail proxy, or sendinblue proxy
      //   eventType = EventType.proxy_loaded;
      // }
    } else if (event.click) {
      let link = event.click.link;
      link = untrackLink(link);
      if (link && link.indexOf('/unsub/') >= 0) {
        log.debug(`${link} is an unsub link. We can ignore this event.`);
        return 'OK';
      }
      if (config.isMirrorLink(link)) {
        log.debug(`${link} is a mirror link. We can ignore this event.`);
        return 'OK';
      }

      details = {
        ts: moment.utc(event.click.timestamp).toDate(),
        userAgent: event.click.userAgent,
        ip: event.click.ipAddress,
        link,

        ipInfo: event.click.ipInfo,
        accepted: event.click.accepted
      };
    } else if (event.unsub) {
      let link = event.unsub.link;
      link = untrackLink(link);
      if (link && link.indexOf('/unsub/') >= 0) {
        log.debug(`${link} is an unsub link. We can ignore this event.`);
        return 'OK';
      }
      if (config.isMirrorLink(link)) {
        log.debug(`${link} is a mirror link. We can ignore this event.`);
        return 'OK';
      }

      details = {
        ts: moment.utc(event.unsub.timestamp).toDate(),
        userAgent: event.unsub.userAgent,
        ip: event.unsub.ipAddress,
        link
      };
    } else if (event.bounce) {
      details = {
        ts: moment.utc(event.bounce.timestamp).toDate(),
        log: event.bounce,
        bounceSubType: event.bounce.bounceSubType
      };
    } else if (event.complaint) {
      details = {
        ts: moment.utc(event.complaint.timestamp).toDate(),
        userAgent: event.complaint.userAgent,
        complainedRecipients: event.complaint.complainedRecipients,
        complaintFeedbackType: event.complaint.complaintFeedbackType,
        feedbackId: event.complaint.feedbackId
      };
    } else if (event.delivery) {
      details = {
        ts: moment.utc(event.delivery.timestamp).toDate()
      };
      ip = event.delivery.ip;
    } else if (event.click_validation_asked) {
      details = {
        ts: moment.utc(event.click_validation_asked.timestamp).toDate(),
        ip: event.click_validation_asked.ipAddress,
        ipInfo: event.click_validation_asked.ipInfo,
        userAgent: event.click_validation_asked.userAgent
      };
    } else if (event.click_validation_checked) {
      details = {
        ts: moment.utc(event.click_validation_checked.timestamp).toDate(),
        ip: event.click_validation_checked.ipAddress,
        userAgent: event.click_validation_checked.userAgent
      };
    }

    let payload = {
      email: event.mail.to,
      eventType: eventType,
      ts: date.getTime(),
      messageId: event.mail.messageId,
      details
    };
    if (ip) {
      payload.ip = ip;
    }

    log.debug(`New Action generated : ${JSON.stringify(payload)}`);
    await (await getActionService()).newAction(ActionType.insert_contact_event, payload);
  } else {
    log.warn(`${event.eventType} seems not supported`);
  }

  return 'OK';
};

/**
 * Un compte Brevo peut servir plusieurs bases (instances v2 et toolso-media) et chaque webhook du compte reçoit tous les
 * événements : en v1, un répartiteur unique triait par étiquette `tls_<uid>`. Ici chaque instance a son URL et ignore
 * les événements étiquetés qui ne portent pas sa propre étiquette `tls_<RESOURCE_UID>` (ceux de media portent `uid_…`).
 * Sans étiquette, l'événement est traité comme avant.
 */
const isSibEventForOtherBase = (sibEvent) => {
  const tags = [].concat(sibEvent.tags ?? [], sibEvent.tag ?? []).filter((t) => typeof t === 'string' && t);
  if (tags.length === 0 || !process.env.RESOURCE_UID) {
    return false;
  }
  return !tags.includes(`tls_${process.env.RESOURCE_UID}`);
};

const handleSibEvent = async (event) => {
  let sibEvent = JSON.parse(event.body);

  if (sibEvent.event.indexOf('contact_') >= 0) {
    return 'OK';
  }
  if (isSibEventForOtherBase(sibEvent)) {
    log.debug(`SIB event for another base (tags ${JSON.stringify(sibEvent.tags ?? sibEvent.tag)}), ignored`);
    return 'OK';
  }
  if (sibEvent.event == 'request') {
    if (sibEvent.tags) {
      for (let tag of sibEvent.tags) {
        if (tag.indexOf('toolso') == 0) {
          log.debug('Toolso request. We can skip it.');
          return 'OK';
        }
      }
    }
    if (sibEvent.tag && Array.isArray(sibEvent.tag)) {
      for (let tag of sibEvent.tag) {
        if (tag.indexOf('toolso') == 0) {
          log.debug('Toolso request. We can skip it.');
          return 'OK';
        }
      }
    } else if (sibEvent.tag && typeof sibEvent.tag === 'string') {
      if (sibEvent.tag.indexOf('toolso') == 0) {
        log.debug('Toolso request. We can skip it.');
        return 'OK';
      }
    }
  }

  let eventType = {
    request: EventType.request,

    click: EventType.click,
    unique_click: EventType.click,

    opened: EventType.open,
    unique_opened: EventType.open,

    proxy_open: EventType.proxy_loaded,

    delivered: EventType.delivered,

    soft_bounce: EventType.soft_bounce,
    hard_bounce: EventType.hard_bounce,

    spam: EventType.complaint,

    blocked: EventType.unsub,
    unsubscribe: EventType.unsub,
    unsubscribed: EventType.unsub
  }[sibEvent.event];

  if (eventType == EventType.click || eventType == EventType.open || eventType == EventType.proxy_loaded) {
    //already tracked by Toolso
    return 'OK';
  }
  if (!eventType) {
    log.warn(`${sibEvent.event} seems not supported`);
    return 'OK';
  }
  var email = sibEvent.email;
  if (email) {
    email = email.trim().toLowerCase();
  }
  var ts = null;

  if ('epoch_ts' in sibEvent) {
    ts = sibEvent.epoch_ts;
  } else if ('ts_epoch' in sibEvent) {
    ts = sibEvent.ts_epoch;
  } else if ('ts_event' in sibEvent) {
    ts = sibEvent.ts_event;
  } else if ('ts' in sibEvent) {
    ts = sibEvent.ts;
  }
  if (ts < 2000000000) {
    ts = ts * 1000;
  }
  if (!ts) {
    ts = new Date().getTime();
  }
  let details = null;
  if (sibEvent.link) {
    let link = untrackLink(sibEvent.link);
    if (link.indexOf('/unsub/') >= 0) {
      log.debug(`${sibEvent.link} is an unsub link. We can ignore this event.`);
      return 'OK';
    }
    if (config.isMirrorLink(link)) {
      log.debug(`${sibEvent.link} is a mirror link. We can ignore this event.`);
      return 'OK';
    }

    details = {
      link: link
    };
  }
  if (eventType === EventType.soft_bounce && sibEvent.reason) {
    details = {
      reason: sibEvent.reason
    };
    if (sibEvent.reason && sibEvent.reason.includes('Unable to find MX')) {
      eventType = EventType.hard_bounce;
    }
    if (sibEvent.reason && sibEvent.reason.includes('this mailbox is inactive and has been disabled')) {
      eventType = EventType.hard_bounce;
    }
    if (sibEvent.reason && sibEvent.reason.toLowerCase().includes('over quota')) {
      eventType = EventType.contact_bounce;
    }
    if (sibEvent.reason && sibEvent.reason.toLowerCase().includes('quota exceeded')) {
      eventType = EventType.contact_bounce;
    }
    if (sibEvent.reason && sibEvent.reason.toLowerCase().includes('mailbox is full')) {
      eventType = EventType.contact_bounce;
    }
    if (sibEvent.reason && sibEvent.reason.toLowerCase().includes('mailbox full')) {
      eventType = EventType.contact_bounce;
    }
    if (sibEvent.reason && sibEvent.reason.toLowerCase().includes('Recipient overquota')) {
      eventType = EventType.contact_bounce;
    }
  }
  let ip = null;
  if (sibEvent.sending_ip && (eventType == EventType.request || eventType == EventType.delivered)) {
    ip = sibEvent.sending_ip;
    //sur les évenements d'ouvertures ou de cliques, SIB envoie n'importe quoi comme IP, du coup je la garde pas.
  }

  let payload = {
    email,
    eventType: eventType,
    ts,
    messageId: sibEvent['message-id'],
    details,
    ip: ip
  };
  log.debug(`New SIB Action generated : ${JSON.stringify(payload)}`);
  await (await getActionService()).newAction(ActionType.insert_contact_event, payload);

  return 'OK';
};

function untrackLink(link) {
  if (!link) {
    return link;
  }

  let firstTrackPart = '/tk/v1/';
  try {
    let indexOfTrack = link.indexOf(firstTrackPart);
    if (indexOfTrack >= 0) {
      let secondPart = link.substring(indexOfTrack + firstTrackPart.length);

      if (secondPart.indexOf('/') > 0) {
        let secretKey = decodeURIComponent(secondPart.split('/')[0]);
        let encryptedLink = decodeURIComponent(secondPart.split('/')[1]);

        let decryptedLink = CryptoJS.AES.decrypt(encryptedLink, secretKey).toString(CryptoJS.enc.Utf8);
        //console.log(decryptedLink);
        return decryptedLink;
      }
    }
  } catch (ex) {
    log.error(`Failed to decrypt link ${link}`, ex);
  }
  return link;
}

const handleMessage = async (event) => {
  if (event.message) {
    let message = event.message;
    delete event['message'];

    let parsed = await simpleParser(message);
    event.content = message;
    event.mail = {
      source: parsed.from.value[0].address,
      timestamp: parsed.date.getTime(),
      commonHeaders: {
        subject: parsed.subject
      },
      messageId: parsed.messageId,
      destination: parsed.to.text.split(',')
    };
    return await handleMessage(event);
  }

  if (!event || !event.mail) {
    log.debug(`No event`);
    log.debug(JSON.stringify(event));
    return 'No event';
  }

  let date = moment.utc(event.mail.timestamp).toDate();
  let email = event.mail.source;
  var title = event.mail.commonHeaders && event.mail.commonHeaders.subject ? event.mail.commonHeaders.subject : '';
  if (title.indexOf('Delivery Status Notification') === 0) {
    log.debug(`Delivery Status Notification`);
    return 'Delivery Status Notification';
  }

  email = email ? email.toLowerCase() : email;

  let parsed = await simpleParser(event.content);

  if (email == 'postmaster@outlook.com' && title.indexOf('Undeliverable' === 0)) {
    log.debug(`postmaster@outlook.com Undeliverable message`);
    return 'postmaster@outlook.com Undeliverable message';
  }

  if (email == 'unsubscribe@vaderetro-safeunsubscribe.com') {
    let message = parsed.html ? parsed.html : parsed.text;

    log.debug('Unsub message from vaderetro');
    let emails = extractEmail(message);
    for (let emailItem of emails) {
      if (emailItem.email.indexOf('unsub') >= 0) {
        continue;
      }
      let payload = {
        email: emailItem.email,
        eventType: EventType.unsub,
        ts: date,
        messageId: null,
        details: {
          origin: 'From webhook (received vaderetro unsubscribe message)'
        }
      };
      await (await getActionService()).newAction(ActionType.insert_contact_event, payload);
    }
    return;
  }

  //console.log(parsed);

  if (email == 'mailer-daemon@eu-west-1.amazonses.com') {
    log.debug(`Mailer daemon`);
    return 'Mailer daemon';
  } else if (email == 'complaints@eu-west-1.email-abuse.amazonses.com') {
    log.debug(`Complaint report`);
    return 'Complaint report';
  } else if (
    email == 'no-reply@amazonses.com' &&
    ((parsed.text && parsed.text.indexOf('This is an email abuse report for an email message from amazonses.com') >= 0) || (title && title.toLowerCase().indexOf('abuse report') >= 0))
  ) {
    log.debug(`Abuse report`);
    return 'Abuse report';
  }
  if (!email) {
    log.debug('No email ...');
    return 'No email ...';
  }
  let to = event.mail.destination ? event.mail.destination.join(',') : '';
  if (to && to.match(/bounces\-[0-9]*\-(.*)\@.*/gm)) {
    log.debug(`It's a bounce notification. We can skip it`);
    return 'Bounce notification';
  }

  if (to && to.indexOf('dmarc@') >= 0) {
    log.debug(`Dmarc report`);
    return 'Dmarc report';
  }

  if (title.indexOf('unsubscribe') >= 0 || to.indexOf('unsub') >= 0) {
    log.debug('Unsub message');

    let subject = parsed.subject;
    let mirrorId = null;
    if (subject && subject.indexOf('unsubscribe#') === 0) {
      mirrorId = subject.substr('unsubscribe#'.length);
    }

    //let message = parsed.html ? parsed.html : parsed.text;
    //log.debug(message);

    let payload = {
      email,
      eventType: EventType.unsub,
      ts: date,
      messageId: null,
      mirrorId,
      details: {
        origin: 'From webhook'
      }
    };
    await (await getActionService()).newAction(ActionType.insert_contact_event, payload);
    return;
  }

  let payload = {
    from: email,
    to,
    date,
    externalId: event.mail.messageId,
    title,
    message: parsed.html ? parsed.html : parsed.text
  };

  //console.log(JSON.stringify(payload));
  await (await getActionService()).newAction(ActionType.insert_contact_message, payload);
};

module.exports = {
  unwrapSns,
  handleWebhook,
  handleSesEvent,
  handleToolsoEvent,
  harakaEventToPayload,
  classifyHarakaBounce,
  handleSibEvent,
  isSibEventForOtherBase,
  untrackLink
};
