const { decryptString } = require('../SettingsService');
const log = require('../../util/log').getLogger('AwsSesRouter');
const { SESClient, SendRawEmailCommand } = require('@aws-sdk/client-ses');
const MailComposer = require('nodemailer/lib/mail-composer');
const { getCommonHeaders } = require('./RouterUtils');

const _sesInstances = {};

/**
 * Routeur d'envoi Amazon SES : c'est un fournisseur d'envoi choisi par le client (`MailRouter` de type `aws_ses`,
 * identifiants chiffrés en base), pas une dépendance d'infrastructure. Migré vers le SDK v3.
 */
const getSESInstance = async (mailRouter) => {
  if (mailRouter.id in _sesInstances) {
    return _sesInstances[mailRouter.id];
  }

  let ses = null;
  if (mailRouter && mailRouter.credentials && mailRouter.config) {
    let decryptedString = await decryptString(mailRouter.credentials);
    let credentials = JSON.parse(decryptedString);
    ses = new SESClient({
      region: mailRouter.config.region,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken
      }
    });
  }
  _sesInstances[mailRouter.id] = {
    mailRouter,
    ses
  };

  return _sesInstances[mailRouter.id];
};

module.exports.sendEmail = async (senderConfig, mail, schedule) => {
  log.debug(`Send email with SES to ${mail.email}`);

  let { mailRouter, ses } = await getSESInstance(senderConfig.sender.mailRouter);
  if (!ses) {
    log.error(`Failed to create SES instance for sender ${senderConfig.sender.id}`);
    return {};
  }

  let configurationSetSelected = null;
  if (mailRouter.config && mailRouter.config.configurationSets && mailRouter.config.configurationSets.length == 1) {
    configurationSetSelected = mailRouter.config.configurationSets[0];
  } else if (mailRouter.config && mailRouter.config.configurationSets && mailRouter.config.configurationSets.length > 1) {
    var rand = Math.random() * 100;
    var count = 0;
    for (let configurationSet of mailRouter.config.configurationSets) {
      if (configurationSet.weight && configurationSet.weight + count >= rand) {
        configurationSetSelected = configurationSet;
        break;
      }
      count += configurationSet.weight ? configurationSet.weight : 0;
    }
    if (!configurationSetSelected) {
      //nothing found. Take last one
      configurationSetSelected = mailRouter.config.configurationSets[mailRouter.config.configurationSets.length - 1];
    }
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

  var mailComposer = new MailComposer({
    from: `${mail.senderName} <${senderConfig.sender.email}>`,
    to: `${mail.email}`,
    html: mail.html,
    text: mail.text,
    subject: mail.subject,
    replyTo: ReplyToAddresses ? ReplyToAddresses[0] : null,
    headers: await getCommonHeaders(mailRouter, mail, senderConfig)
  });

  let rawEmail = await new Promise((resolve, reject) => {
    mailComposer.compile().build(function (err, message) {
      if (err) {
        return reject(err);
      }
      resolve(message);
    });
  });

  let senderName = Buffer.from(mail.senderName).toString('base64');

  let Source = `=?UTF-8?B?${senderName}?= <${senderConfig.sender.email}>`;
  try {
    let sesMessage = await ses.send(
      new SendRawEmailCommand({
        Destinations: [mail.email],
        RawMessage: {
          Data: rawEmail
        },
        Source: Source,
        ConfigurationSetName: configurationSetSelected ? configurationSetSelected.name : undefined
      })
    );

    log.debug(`SES Message sent. Response is ${JSON.stringify(sesMessage)}`);
    return {
      messageId: sesMessage.MessageId,
      ipId: senderConfig.ipId ? senderConfig.ipId : null
    };
  } catch (ex) {
    log.error(`Failed to send email`, ex);
    log.error(JSON.stringify(ex));
    return {
      messageId: null,
      throttling: ex.toString().indexOf('Throttling') >= 0 || ex?.name === 'Throttling'
    };
  }
};
