const log = require('../../util/log').getLogger('ToolsoRouter');

const IpAddressService = require('../IpAddressService');
const MailComposer = require('nodemailer/lib/mail-composer');
const fetch = require('../../infra/getNodeFetch')();
const { getCommonHeaders } = require('./RouterUtils');

module.exports.sendEmail = async (senderConfig, mail, schedule, content) => {
  log.debug(`Send email with Toolso Routeur to ${mail.email}`);

  let mailRouter = senderConfig.sender.mailRouter;
  if (!mailRouter) {
    log.error(`Failed to get mail router instance for sender ${senderConfig.sender.id}`);
    return {};
  }

  let ReplyToAddresses = null;

  let replyToEmail = senderConfig.replyToEmail ? senderConfig.replyToEmail : senderConfig.sender.replyToEmail;
  let replyToName = senderConfig.replyToName ? senderConfig.replyToName : senderConfig.sender.replyToName;
  if (replyToEmail) {
    if (replyToName) {
      ReplyToAddresses = [`${replyToName} <${replyToEmail}>`];
    } else {
      ReplyToAddresses = [`${replyToEmail}`];
    }
  }

  let headers = await getCommonHeaders(mailRouter, mail, senderConfig, content, schedule);

  // headers['X-Toolso-uid'] = process.env.RESOURCE_UID;
  var mailComposer = new MailComposer({
    from: `"${mail.senderName}" <${senderConfig.sender.email}>`,
    to: `${mail.email}`,
    html: mail.html,
    text: mail.text,
    subject: mail.subject,
    replyTo: ReplyToAddresses ? ReplyToAddresses[0] : null,
    headers
  });

  let rawEmail = await new Promise((resolve, reject) => {
    mailComposer.compile().build(function (err, message) {
      if (err) {
        return reject(err);
      }
      resolve(message.toString());
    });
  });

  let ip = null;
  let ip_dns = null;
  let ip_bind = null;
  let ipAddress = null;

  if (mailRouter.config && mailRouter.config.ips && mailRouter.config.ips.length > 1) {
    var rand = Math.random() * 100;
    var count = 0;
    for (let item of mailRouter.config.ips) {
      if (item.weight && item.weight + count >= rand) {
        ip = item.ip;
        ip_dns = item.ip_dns;

        break;
      }
      count += item.weight ? item.weight : 0;
    }
    if (!ip) {
      //nothing found. Take last one
      ip = mailRouter.config.ips[mailRouter.config.ips.length - 1].ip;
      ip_dns = mailRouter.config.ips[mailRouter.config.ips.length - 1].ip_dns;
    }
  } else if (mailRouter.config && mailRouter.config.ips && mailRouter.config.ips.length == 1) {
    ip = mailRouter.config.ips[0].ip;
    ip_dns = mailRouter.config.ips[0].ip_dns;
    ip_bind = mailRouter.config.ips[0].ip_bind;
  } else if (mailRouter.config && mailRouter.config.ip) {
    ip = mailRouter.config.ip;
    ip_dns = mailRouter.config.ip_dns;
    ip_bind = mailRouter.config.ip_bind;
  }
  if (ip) {
    ipAddress = await new IpAddressService().getIpAddressFromCache(ip);
  }
  try {
    const endpoint = mailRouter.config.endpoint;
    //const endpoint = 'http://localhost:5000/sendRawEmail';

    let result = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: `${senderConfig.sender.email}`,
        to: mail.email,
        content: rawEmail,
        details: {
          webhookEndpoint: mailRouter.config.webhookEndpoint,
          outboundIp: {
            ip: ip,
            dns: ip_dns,
            ip_bind: ip_bind
          }
        }
      })
    });

    result = await result.json();

    log.debug(`Toolso Message sent. Response is ${JSON.stringify(result)}`);
    return {
      messageId: result.messageId,
      ipId: ipAddress ? ipAddress.id : null
    };
  } catch (ex) {
    log.error(`Failed to send email`, ex);
    log.error(JSON.stringify(ex));
    return {
      messageId: null,
      throttling: ex.toString().indexOf('Throttling') >= 0
    };
  }
};

