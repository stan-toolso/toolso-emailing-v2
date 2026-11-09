const log = require('../util/log').getLogger('ToolsoEmailService');
const path = require('path');
const pug = require('pug');
const nodemailer = require('nodemailer');
const config = require('../util/config');

let _transport = null;
const getTransport = () => {
  if (_transport) {
    return _transport;
  }
  const smtpUrl = config.smtpUrl();
  if (!smtpUrl) {
    return null;
  }
  _transport = nodemailer.createTransport(smtpUrl);
  return _transport;
};

/**
 * Mails de la plateforme (alertes, BAT, exports, suggestions) : SMTP (`SMTP_URL`) à la place de SES.
 * Sans `SMTP_URL`, le mail est journalisé et non envoyé.
 */
const sendEmail = async (template, subject, variables, tos) => {
  tos = (tos ?? []).filter((to) => !!to);
  if (tos.length === 0) {
    log.warn(`No recipient for email "${subject}" (template ${template}). Skipped.`);
    return;
  }
  const html = pug.renderFile(path.join(__dirname, '..', '..', 'views', 'emails', `${template}.pug`), { publicUrl: config.publicUrl(), ...variables });

  const transport = getTransport();
  if (!transport) {
    log.warn(`SMTP_URL is not configured: email "${subject}" to ${tos.join(', ')} not sent.`);
    return;
  }
  const info = await transport.sendMail({
    from: config.mailFrom(),
    to: tos,
    subject,
    html
  });
  log.debug(`Message sent. ${info && info.messageId}`);
};

module.exports = {
  sendEmail,
  /** Pour les tests : remplace le transport nodemailer. */
  _setTransport: (transport) => {
    _transport = transport;
  }
};
