const log = require('../../util/log').getLogger('track_event');
const { handleToolsoEvent } = require('../../api/webhooks/webhookHandlers');

let _mirrorService = null;

/**
 * Événement de tracking (clic, ouverture, désabonnement, validation de clic) reçu par les routes /tk, /tkc, /tko, /unsub.
 * Reprend la Lambda `track_events` : on retrouve le message par son miroir, puis on construit le même événement
 * que le webhook du routeur Toolso.
 */
module.exports = async (event) => {
  if (!event || !event.mirrorId) {
    log.debug('Track event without mirrorId. Ignored.');
    return;
  }
  if (!_mirrorService) {
    const MirrorService = require('../MirrorService');
    _mirrorService = new MirrorService();
  }
  const message = await _mirrorService.find(event.mirrorId);
  if (!message || !message.to) {
    log.debug(`No mirror found for ${event.mirrorId}. Event ignored.`);
    return;
  }
  const payload = {
    mail: {
      to: message.to,
      timestamp: event.timestamp,
      messageId: message.messageId
    },
    eventType: event.eventType
  };
  switch (event.eventType) {
    case 'Click':
      payload.click = {
        timestamp: event.timestamp,
        link: event.href,
        userAgent: event.userAgent,
        ipAddress: event.ipAddress,
        accepted: event.accepted,
        ipInfo: event.ipInfo
      };
      break;
    case 'Open':
      payload.open = {
        timestamp: event.timestamp,
        userAgent: event.userAgent,
        ipAddress: event.ipAddress
      };
      break;
    case 'Unsub':
      payload.unsub = {
        link: event.href,
        timestamp: event.timestamp,
        userAgent: event.userAgent,
        ipAddress: event.ipAddress
      };
      break;
    case 'ClickValidationAsked':
      payload.click_validation_asked = {
        userAgent: event.userAgent,
        ipAddress: event.ipAddress,
        ipInfo: event.ipInfo,
        timestamp: event.timestamp
      };
      break;
    case 'ClickValidationChecked':
      payload.click_validation_checked = {
        userAgent: event.userAgent,
        ipAddress: event.ipAddress,
        timestamp: event.timestamp
      };
      break;
    case 'Complaint':
      payload.complaint = {
        timestamp: event.timestamp,
        complaintFeedbackType: event.complaintFeedbackType ?? 'FromFBL'
      };
      break;
    default:
      log.warn(`Track event type ${event.eventType} not supported`);
      return;
  }
  await handleToolsoEvent({ body: JSON.stringify(payload) });
};
