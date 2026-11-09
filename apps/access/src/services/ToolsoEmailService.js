const log = require('../log').getLogger('ToolsoEmailService');
const path = require('path');
const pug = require('pug');
const nodemailer = require('nodemailer');
const config = require('../config');

const VIEWS_DIR = path.join(__dirname, '..', '..', 'views', 'emails');

let _transport = null;
let _warned = false;

// Transport SMTP depuis SMTP_URL (smtp://user:pass@host:587, smtps://… pour TLS implicite).
// Sans SMTP_URL, les mails ne sont pas envoyés : ils sont journalisés (développement, tests).
const getTransport = () => {
  if (_transport) {
    return _transport;
  }
  const smtpUrl = config.smtpUrl();
  if (!smtpUrl) {
    if (!_warned) {
      log.warn(`SMTP_URL is not set: e-mails will be logged instead of sent`);
      _warned = true;
    }
    return null;
  }
  _transport = nodemailer.createTransport(smtpUrl);
  return _transport;
};

const sendEmail = async (template, subject, variables, tos) => {
  const from = config.mailFrom();

  const html = pug.renderFile(path.join(VIEWS_DIR, `${template}.pug`), { publicUrl: config.publicUrl(), ...variables });

  const transport = getTransport();
  if (!transport) {
    log.warn(`[mail not sent] to=${tos.join(',')} subject="${subject}" template=${template} variables=${JSON.stringify(variables)}`);
    return null;
  }

  const info = await transport.sendMail({ from, to: tos, subject, html });
  log.debug(`Message sent. ${info.messageId}`);
  return info;
};

module.exports = {
  sendEmail
};
