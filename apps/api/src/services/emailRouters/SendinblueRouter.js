const { decryptString, getCachedSettings } = require('../SettingsService');
const log = require('../../util/log').getLogger('SendinblueRouter');

const fetch = require('node-fetch');

const IpAddressService = require('../IpAddressService');
const { getCommonHeaders } = require('./RouterUtils');

const _instances = {};

const getInstance = async (mailRouter) => {
  if (mailRouter.id in _instances) {
    return _instances[mailRouter.id];
  }

  let credentials = null;
  if (mailRouter && mailRouter.credentials && mailRouter.config) {
    let decryptedString = await decryptString(mailRouter.credentials);
    credentials = JSON.parse(decryptedString);
  }
  _instances[mailRouter.id] = {
    mailRouter,
    credentials
  };

  return _instances[mailRouter.id];
};

module.exports.sendEmail = async (senderConfig, mail, schedule) => {
  log.debug(`Send email with SIB to ${mail.email}`);

  let { mailRouter, credentials } = await getInstance(senderConfig.sender.mailRouter);
  if (!mailRouter || !credentials) {
    log.error(`Failed to create SIB instance for sender ${senderConfig.sender.id}`);
    return {};
  }

  let ipSelected = null;
  if (mailRouter.config && mailRouter.config.ips && mailRouter.config.ips.length == 1) {
    ipSelected = mailRouter.config.ips[0];
  } else if (mailRouter.config && mailRouter.config.ips && mailRouter.config.ips.length > 1) {
    var rand = Math.random() * 100;
    var count = 0;
    for (let ip of mailRouter.config.ips) {
      if (ip.weight && ip.weight + count >= rand) {
        ipSelected = ip;
        break;
      }
      count += ip.weight ? ip.weight : 0;
    }
    if (!ipSelected) {
      //nothing found. Take last one
      ipSelected = mailRouter.config.ips[mailRouter.config.ips.length - 1];
    }
  }

  let replyTo = null;
  let replyToEmail = senderConfig.replyToEmail ? senderConfig.replyToEmail : senderConfig.sender.replyToEmail;
  let replyToName = senderConfig.replyToName ? senderConfig.replyToName : senderConfig.sender.replyToName;
  if (replyToEmail) {
    if (replyToName) {
      replyTo = {
        email: replyToEmail,
        name: replyToName
      };
    } else {
      replyTo = {
        email: replyToEmail,
        name: mail.senderName
      };
    }
  }
  let tags = [`tls_${process.env.RESOURCE_UID}`, 'toolso', `schedule_${schedule ? schedule.id : 'null'}`];

  if (schedule && schedule.parentId) {
    tags.push(`schedule_${schedule.parentId}`);
  }
  let body = {
    sender: {
      email: senderConfig.sender.email,
      name: mail.senderName
    },
    to: [
      {
        email: mail.email
      }
    ],
    htmlContent: mail.html,
    /*textContent : mail.text,*/
    subject: mail.subject,
    replyTo,
    tags
  };
  let ipAddress = null;
  body.headers = await getCommonHeaders(mailRouter, mail, senderConfig);

  if (ipSelected) {
    body.headers['sender.ip'] = ipSelected.ip;
    ipAddress = await new IpAddressService().getIpAddressFromCache(ipSelected.ip);
  }
  if (Object.keys(body.headers) == 0) {
    delete body['headers'];
  }

  let startTs = new Date().getTime();
  let res = await fetch('https://api.sendinblue.com/v3/smtp/email', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
      'api-key': credentials.apiKeyV3
    }
  });
  let ok = res.status >= 100 && res.status < 400 ? true : false;
  let endTs = new Date().getTime();
  log.debug(`SIB Email sent in ${endTs - startTs} ms. Status ${res.status}`);
  if (ok) {
    let bodyResult = await res.json();
    return {
      messageId: bodyResult.messageId,
      ipId: ipAddress ? ipAddress.id : null
    };
  }

  log.warn(`Failed to send email with SIB. Status:${res.status}.`);

  let bodyResult = await res.text();
  // status 524 is for timeout
  if (res.status == 429 || (bodyResult && bodyResult.indexOf('Too Many Requests') >= 0)) {
    return {
      throttling: true
    };
  }
  log.warn(`${bodyResult}`);
  return {};
};
