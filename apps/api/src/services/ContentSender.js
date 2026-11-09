const log = require('../util/log').getLogger('ContentSender');
var moment = require('moment-timezone');
const { getJwtSecret } = require('./JwtSecretService');
const { v4: uuidv4 } = require('uuid');
var CryptoJS = require('crypto-js');

const ContactEventService = require('./ContactEventService');
const ContactService = require('./ContactService');
const SourceService = require('./SourceService');
const ContentService = require('./ContentService');
const SenderService = require('./SenderService');
const SendingConfigService = require('./SendingConfigService');
const { getCachedSettings } = require('./SettingsService');
const { extractEsp, isFrench } = require('./EspService');
const MirrorService = require('./MirrorService');
const config = require('../util/config');

const toPascalCase = require('./utils/toPascalCase');

var AwsSesRouter = require('./emailRouters/AwsSesRouter');
var SendinblueRouter = require('./emailRouters/SendinblueRouter');
var ToolsoRouter = require('./emailRouters/ToolsoRouter');
const EventType = require('../storage/models/EventType');

const { htmlReplace } = require('./htmlReplace');

module.exports = class {
  constructor() {
    this.contactEventService = new ContactEventService();
    this.contactService = new ContactService();
    this.contentService = new ContentService();
    this.sourceService = new SourceService();
    this.senderService = new SenderService();
    this.sendingConfigService = new SendingConfigService();

    this.mirrorService = new MirrorService();
  }

  sendContactMessage = async (email, subject, senderName, html, templateVariables, sendingConfigId) => {
    let contact = await this.contactService.findWithEmail(email);
    if (!contact) {
      contact = {
        id: null,
        email,
        esp: extractEsp(email)
      };
    }
    let sendingConfig = await this.sendingConfigService.findWithId(sendingConfigId);
    if (!sendingConfig) {
      log.warn(`Failed to send message with sending config ${sendingConfigId}, because config not found`);
      return;
    }
    const schedule = {
      id: null,
      name: 'Temp schedule',
      sendingConfig,
      getSendingConfig: async () => {
        return sendingConfig;
      }
    };
    let senderConfig = await this.extractSenderConfigForContact(schedule, contact);
    if (!senderConfig) {
      log.error('sender_config_not_found', `Can't find configuration to send BAT to contact ${contact.email} with schedule ${schedule.name}.`);
    }

    return await this.sendContent(
      schedule,
      contact,
      {
        id: null,
        name: 'Temp content'
      },
      {
        html,
        templateVariables,
        senderName,
        subject
      },
      senderConfig,
      false,
      {},
      null,
      null
    );
  };

  sendContentVersionTest = async (emails, contentId, versionId = null, sendingConfigId) => {
    log.debug(`Sent Content Version Test to  ${emails} on content ${contentId};${versionId} `);
    let result = {
      events: [],
      errors: []
    };
    let contacts = [];
    for (let email of emails) {
      let contact = await this.contactService.findWithEmail(email);
      if (contact) {
        contacts.push(contact);
      } else {
        contacts.push({
          email,
          firstname: 'Alexandre',
          lastname: 'Dupont',
          zipcode: '33000',
          city: 'Bordeaux',
          phone: '0667543426',
          street: '8 Cours de Luze',
          dob: '1984-07-06',
          gender: 'm',
          esp: extractEsp(email)
        });
      }
    }
    let content = await this.contentService.findWithId(contentId);

    if (!content) {
      result.errors.push({
        code: 'content_not_found',
        resource: contentId,
        message: `Content ${contentId} doesn't exists anymore.`
      });
      return result;
    }

    let versions = await content.getVersions();
    let defaultVersion = content && versions && versions.length > 0 ? versions[0] : null;

    if (versionId) {
      for (let version of versions) {
        if (version.id == versionId) {
          defaultVersion = version;
          break;
        }
      }
    }

    if (!defaultVersion) {
      result.errors.push({
        code: 'no_default_content version',
        resource: contentId,
        message: `Content ${contentId} doesn't have default version defined.`
      });
      return result;
    }

    let sendingConfig = await this.sendingConfigService.findWithId(sendingConfigId);
    if (!sendingConfig) {
      log.warn(`Failed to send message with sending config ${sendingConfigId}, because config not found`);
      result.errors.push({
        code: 'no_sending_config',
        resource: sendingConfigId,
        message: `Sending config ${sendingConfigId} doesn't exists.`
      });
      return result;
    }
    const schedule = {
      id: null,
      name: 'Temp schedule',
      sendingConfig,
      getSendingConfig: async () => {
        return sendingConfig;
      }
    };

    if (content && defaultVersion && schedule) {
      for (let contact of contacts) {
        let senderConfig = await this.extractSenderConfigForContact(schedule, contact);
        if (!senderConfig) {
          result.errors.push({
            code: 'sender_config_not_found',
            message: `Can't find configuration to send BAT to contact ${contact.email} with schedule ${schedule.name}.`
          });
        } else {
          try {
            let event = await this.sendContent(schedule, contact, content, defaultVersion, senderConfig, true);
            if (event) {
              event = JSON.parse(JSON.stringify(event));
              event.email = contact.email;
              result.events.push(event);
            } else {
              result.errors.push({
                code: 'sending_error',
                message: `Content ${contentId} can't be sent.`
              });
            }
          } catch (err) {
            log.error(err);
            result.errors.push({
              code: 'sending_error',
              message: `Content ${contentId} can't be sent.`,
              message_detail: JSON.stringify(err)
            });
          }
        }
      }
    }

    return result;
  };

  sendBat = async (bat, content, version, multiVersion, replyTo, validation = null) => {
    log.debug(`Sent BAT ${bat.id} to  ${bat.validator} on content ${content.id}, version ${version.id}`);

    let validatorsEmails = bat.validatorsEmails
      .toLowerCase()
      .split(',')
      .map((a) => {
        return a.trim();
      });
    if (validatorsEmails.length <= 0) {
      log.warn(`No validators found to send BAT  ${bat.id}`);
      return [
        {
          code: 'no_validators',
          message: `BAT ${bat.id} hasn't validators configured.`
        }
      ];
    }

    let results = [];
    for (let validator of validatorsEmails) {
      let contact = await this.contactService.findWithEmail(validator);
      if (!contact) {
        contact = {
          email: validator,
          firstname: 'Alexandre',
          lastname: 'Dupont',
          zipcode: '33000',
          city: 'Bordeaux',
          phone: '0667543426',
          street: '8 Cours de Luze',
          dob: '1984-07-06',
          gender: 'm',
          esp: extractEsp(validator)
        };
      }
      let sendingConfig = await bat.getSendingConfig();
      let senderConfig = await this.extractSenderConfigForContact(null, contact, sendingConfig);
      if (!senderConfig) {
        results.push({
          email: contact.email,
          code: 'sender_config_not_found',
          message: `Can't find configuration to send BAT to contact ${contact.email} with sending config ${sendingConfig.name}.`
        });
        continue;
      } else {
        if (replyTo) {
          senderConfig.replyToEmail = replyTo;
          senderConfig.replyToName = '';
        }
        try {
          const RESOURCE_UID = process.env.RESOURCE_UID;
          let subjectPrefix = `[BAT][${RESOURCE_UID}]${validation ? (validation.status == 'validated' ? '[Validated]' : '[Rejected]') : ''} - ${multiVersion ? version.name + ' - ' : ''}`;
          let bodyPrefix = await this.getBatBodyPrefix(bat, version, validator, validation, content, contact);
          let event = await this.sendContent(null, contact, content, version, senderConfig, true, null, subjectPrefix, bodyPrefix);
          if (event) {
            let newEvent = {
              ...JSON.parse(JSON.stringify(event)),
              html: event.html,
              subject: event.subject,
              senderName: event.senderName,
              email: contact.email
            };
            results.push(newEvent);
          } else {
            results.push({
              email: contact.email,
              code: 'sending_error',
              message: `Content ${content.id} can't be sent.`
            });
          }
        } catch (err) {
          log.error(err);
          results.push({
            email: contact.email,
            code: 'sending_error',
            message: `Content ${content.id} can't be sent.`,
            message_detail: JSON.stringify(err)
          });
        }
      }
    }
    return results;
  };

  sendContent = async (schedule, contact, content, contentVersion, senderConfig, isBat = false, details = {}, subjectPrefix = null, bodyPrefix = null, contactScore) => {
    log.debug(`Send content [${content.id},${contentVersion.id}] to contact [${contact.email}] with schedule [${schedule ? schedule.name : 'null'}]`);
    let french = isFrench(contact.esp);
    let mirrorId = uuidv4();

    let { trackingDomain, language, countryCode, canEditSenderName } = await getCachedSettings(['trackingDomain', 'language', 'countryCode', 'canEditSenderName']);
    let sender = await this.senderService.findWithIdInCache(senderConfig.senderId);
    if (!sender) {
      log.warn(`Sender ${senderConfig.senderId} not found`);
      return null;
    }

    if (!sender.mailRouter) {
      log.warn(`Sender ${senderConfig.senderId} hasn't mail router configured`);
      return null;
    }
    senderConfig.sender = sender;
    let forceCleanOs = sender.mailRouter.type !== 'toolso';

    if (sender.trackingDomain) {
      trackingDomain = sender.trackingDomain;
    }

    const encryptKey = Math.random().toString(36).slice(2, 10);

    let unsubDomain = trackingDomain ? trackingDomain : config.apiPublicUrl();
    let mirrorDomain = unsubDomain;
    let unsubEncryptedObject = {
      email: contact.email,
      mirrorId,
      uid: process.env.RESOURCE_UID
    };
    unsubEncryptedObject = CryptoJS.AES.encrypt(JSON.stringify(unsubEncryptedObject), encryptKey).toString();
    let source = null;
    let lastSource = contact.lastSourceId ? await this.sourceService.findWithIdInCache(contact.lastSourceId) : null;
    if (lastSource) {
      source = {
        id: lastSource.id,
        name: lastSource.name,
        utmSource: lastSource.utmSource
      };
    }

    let settingsLink = (await getCachedSettings(['settingsLink'])).settingsLink;
    let uiSecretKey = (await getCachedSettings(['uiSecretKey'])).uiSecretKey;

    if (settingsLink && uiSecretKey) {
      let token = CryptoJS.AES.encrypt(contact.id.toString(), uiSecretKey).toString();
      settingsLink += token;
    }

    let unsubLink = `${unsubDomain}/unsub/${language}/${encryptKey}/${encodeURIComponent(unsubEncryptedObject)}`;

    //lien vers la page publique de gestion du consentement au pixel de tracking
    let { apiEndpoint } = await getCachedSettings(['apiEndpoint']);
    let pixelConsentEncryptedObject = CryptoJS.AES.encrypt(
      JSON.stringify({
        email: contact.email,
        mirrorId,
        uid: process.env.RESOURCE_UID
      }),
      encryptKey
    ).toString();
    let pixelConsentLink = `${apiEndpoint}/pixel_consent/${encryptKey}/${encodeURIComponent(pixelConsentEncryptedObject)}`;

    let cleanPersonnalData = (personnalData) => {
      if (!personnalData) {
        return personnalData;
      }
      personnalData = personnalData.replace(/[{}]/g, '');
      return personnalData;
    };
    let variables = {
      contact: {
        id: contact.id,
        email: cleanPersonnalData(contact.email),
        firstname: cleanPersonnalData(contact.firstname),
        lastname: cleanPersonnalData(contact.lastname),
        zipcode: cleanPersonnalData(contact.zipcode),
        gender: contact.gender,
        dob: contact.dob,
        dbo: contact.dob,
        street: cleanPersonnalData(contact.street),
        city: cleanPersonnalData(contact.city),
        phone: cleanPersonnalData(contact.phone),
        md5: contact.md5,
        sha1: contact.sha1,
        sha256: contact.sha256,
        customFields: contact.customFields,
        source
      },
      email: contact.email,
      mirror: `${mirrorDomain}/m/${mirrorId}`,
      mirrorLink: `${mirrorDomain}/m/${mirrorId}`,

      unsubLink,
      unsubscribe: unsubLink,
      pixelConsentLink,
      settingsLink,

      genderFormat: function () {
        return function (text, render) {
          let formats = render(text);
          if (!contact.gender) {
            return '';
          }
          if (!formats) {
            return contact.gender;
          }
          formats = formats.split(',');
          if (contact.gender == 'm') {
            return formats.length > 1 ? formats[1] : contact.gender;
          }
          return formats[0];
        };
      },
      dobFormat: function () {
        return function (text, render) {
          let format = render(text);
          if (!contact.dob) {
            return '';
          }
          return moment(contact.dob).format(format);
        };
      }
    };

    let { html, subject, senderName, previewText, frenchEspsSubject } = await this.contentService.compileContentVersion(content, contentVersion, variables, isBat);

    subject = french || forceCleanOs ? frenchEspsSubject ?? subject : subject;
    if (!subject) {
      await this.deactivation(content, contentVersion, contact, senderConfig, schedule, isBat, 'no_subject', contactScore);
      return null;
    }

    if (!html) {
      await this.deactivation(content, contentVersion, contact, senderConfig, schedule, isBat, 'no_html', contactScore);
      return null;
    }

    // Le corps est archive (S3/DynamoDB) uniquement si le template utilise reellement le
    // lien "voir en ligne". Le test se fait ICI, avant htmlReplace : ensuite les href sont
    // reecrits en URL de tracking et l'URL du miroir n'apparait plus en clair.
    // Mesure du 2026-09-01 : seuls 21% des emails contiennent ce lien (53 echantillons),
    // les 79% restants generaient un PUT S3 inutile (~137 $/mois).
    const usesMirrorLink = typeof html === 'string' && html.indexOf(mirrorId) >= 0;

    let fullHtml;
    let textVersion;
    ({ fullHtml, textVersion, html } = htmlReplace({ trackingDomain, html, mirrorId, schedule, contact, language, countryCode, encryptKey, previewText, bodyPrefix }));
    let fullSubject = subject;
    if (subjectPrefix) {
      fullSubject = subjectPrefix + subject;
    } else if (isBat) {
      fullSubject = `TEST - ${subject}`;
    }

    if (!canEditSenderName || !senderName || !senderName.trim() || ((french || forceCleanOs) && sender.senderName)) {
      senderName = sender.senderName;
    }

    let mail = {
      email: contact.email,
      html: fullHtml,
      text: textVersion,
      subject: fullSubject,
      senderName,
      unsubLink,
      mirrorId
    };

    let event = await this.sendMessage(senderConfig, mirrorId, mail, contact, schedule, content, contentVersion, 0, isBat, details, contactScore, usesMirrorLink);
    if (event) {
      event.html = html;
      event.subject = subject;
      event.senderName = senderName;
      event.mirrorLink = variables.mirrorLink;

      //if contact is still not activated, we force the refresh of status before the next hour
      if (contact && contact.id && !contact.activated && (!contact.nextStatusUpdateDate || moment(contact.nextStatusUpdateDate) > moment().add(1, 'hours'))) {
        log.debug(`Set next status update date to now for contact ${contact.id}`);
        contact.nextStatusUpdateDate = new Date();
        await contact.save();
      }
    }
    return event;
  };

  async deactivation(content, contentVersion, contact, senderConfig, schedule, isBat, reason, contactScore) {
    log.error(`Subject is empty for content ${content.id} version ${contentVersion.id}`);
    await this.contactEventService.insertNewEvent(
      contact.email,
      EventType.no_request,
      new Date(),
      null,
      null,
      senderConfig.senderId,
      schedule ? (schedule.parentId ? schedule.parentId : schedule.id) : null,
      content.id,
      contentVersion.id,
      contact.lastInscriptionId,
      {
        reason
      },
      isBat,
      contact,
      contactScore
    );
    content.isActive = false;
    await content.save();

    await this.historyService.createHistory(
      'Toolso',
      { suspensionReason: toPascalCase(reason), additionalText: `${toPascalCase(reason)} for content` },
      'content_deactivation',
      'content',
      content.id,
      4
    );
  }

  async sendMessage(senderConfig, mirrorId, mail, contact, schedule, content, contentVersion, retryCount = 0, isBat = false, details = {}, contactScore, usesMirrorLink = true) {
    log.debug('send message begin');
    let router = null;
    let mailRouterType = senderConfig.sender.mailRouter ? senderConfig.sender.mailRouter.type : null;
    switch (mailRouterType) {
      case 'aws_ses':
        router = AwsSesRouter;
        break;
      case 'sib':
        router = SendinblueRouter;
        break;
      case 'toolso':
        router = ToolsoRouter;
        break;

      default:
        log.warn(`No router found for type ${mailRouterType}`);
        return null;
    }

    let sendDate = new Date();

    try {
      let { messageId, throttling, ipId } = await router.sendEmail(senderConfig, mail, schedule, content);
      if (!messageId && throttling) {
        if (retryCount >= 5) {
          let event = await this.contactEventService.insertNewEvent(
            contact.email,
            EventType.no_request,
            sendDate,
            null,
            ipId,
            senderConfig.senderId,
            schedule ? (schedule.parentId ? schedule.parentId : schedule.id) : null,
            content.id,
            contentVersion.id,
            contact.lastInscriptionId,
            {
              reason: 'max_throttling',
              throttling: true,
              retryCount,
              routeur: mailRouterType
            },
            isBat,
            contact,
            contactScore
          );
          if (event) {
            event.senderEmail = senderConfig.sender.email;
          }
          return event;
        }
        log.warn(`Received a throttling message. Wait a little, and try again (retry ${retryCount + 1})`);
        await new Promise((r) => setTimeout(r, 2000));
        return await this.sendMessage(senderConfig, mirrorId, mail, contact, schedule, content, contentVersion, retryCount + 1, isBat, details, contactScore, usesMirrorLink);
      }

      if (messageId) {
        await this.mirrorService.store({
          mirrorId,
          messageId,
          to: contact.email,
          subject: mail.subject,
          source: `${mail.senderName} <${senderConfig.sender.email}>`,
          html: mail.html,
          storeBody: usesMirrorLink
        });
        let event = await this.contactEventService.insertNewEvent(
          contact.email,
          EventType.request,
          sendDate,
          messageId,
          ipId,
          senderConfig.senderId,
          schedule ? (schedule.parentId ? schedule.parentId : schedule.id) : null,
          content.id,
          contentVersion.id,
          contact.lastInscriptionId,
          details,
          isBat,
          contact,
          contactScore
        );
        if (event) {
          event.senderEmail = senderConfig.sender.email;
        }
        return event;
      } else {
        let event = await this.contactEventService.insertNewEvent(
          contact.email,
          EventType.no_request,
          sendDate,
          null,
          ipId,
          senderConfig.senderId,
          schedule ? (schedule.parentId ? schedule.parentId : schedule.id) : null,
          content.id,
          contentVersion.id,
          contact.lastInscriptionId,
          {
            reason: 'no_message_id',
            throttling: false,
            retryCount,
            routeur: mailRouterType
          },
          isBat,
          contact,
          contactScore
        );
        if (event) {
          event.senderEmail = senderConfig.sender.email;
        }
        return event;
      }
    } catch (ex) {
      log.error(`Failed to send message`, ex);
    }
    return null;
  }

  async getBatBodyPrefix(bat, version, validator, validation, content, contact) {
    let jwtSecret = await getJwtSecret();
    let token = CryptoJS.AES.encrypt(`${bat.id}#${validator}`, jwtSecret).toString();

    let variables = {
      contact: {
        id: contact.id,
        email: contact.email,
        firstname: contact.firstname,
        lastname: contact.lastname,
        zipcode: contact.zipcode,
        gender: contact.gender,
        dob: contact.dob,
        street: contact.street,
        city: contact.city,
        phone: contact.phone,
        dbo: contact.dob,
        md5: contact.md5,
        sha1: contact.sha1,
        sha256: contact.sha256,
        customFields: contact.customFields
      },
      email: contact.email
    };

    let { subject, senderName, frenchEspsSubject } = await this.contentService.compileContentVersion(content, version, variables, true);
    subject = isFrench(contact.esp) ? frenchEspsSubject : subject;
    let { apiEndpoint } = await getCachedSettings(['apiEndpoint']);

    if (validation) {
      return `
        <div style="width: 100%; min-width: 400px;  background-color: #EEE; margin-bottom: 10px; padding: 5px 0px; border-radius: 3px">
            <h1 style="text-align: center"> BAT validation</h1>
            <div style="border: 1px solid #CCC;border-radius: 1px; padding: 3px; min-height: 40px; background-color: #FFF; margin: 10px;">${bat.message}</div>

            <table style="width: 400px; margin: auto;">
                <tr>
                    <td align="right">
                        <span style="padding:5px">Name:</span>
                    </td>
                    <td align="left">
                    ${content.name}
                    </td>
                </tr>
                <tr>
                    <td align="right">
                        <span style="padding:5px">Sendername:</span>
                    </td>
                    <td align="left">
                    ${senderName}
                    </td>
                </tr>
                <tr>
                    <td align="right">
                        <span style="padding:5px">Subject:</span>
                    </td>
                    <td align="left">
                    ${subject}
                    </td>
                </tr>
                <tr>
                    <td align="right">
                        <span style="padding:5px">Status:</span>
                    </td>
                    <td align="left">
                    ${validation.status == 'validated' ? ' <div style=" color: #2eb85c;font-weight : bold">Validated</div>' : ' <div style=" color: #e55353;font-weight : bold">Rejected</div>'}
                  
                    </td>
                </tr>
                <tr>
                    <td align="right">
                        <span style="padding:5px">Validator:</span>
                       
                    </td>
                    <td align="left">
                       <div style="font-weight : bold">${validation.validator}</div>
                    </td>
                </tr>
                <tr>
                    <td align="right">
                    <span style="padding:5px">Comment:</span>
                    </td>
                    <td align="left">
                    <div style="font-weight : bold">${validation.comment ? validation.comment.message : ''}</div>
                    </td>
                </tr>
              
            </table>
      
      
    <div>
        `;
    } else {
      let message = bat.message ? bat.message : '';

      return `
        <div style="width: 100%; min-width: 400px;  background-color: #EEE; margin-bottom: 10px; padding: 5px 0px; border-radius: 3px">
            <h1 style="text-align: center"> BAT validation</h1>


            <table style="width: 400px; margin: auto;">
                <tr>
                    <td align="right">
                        <span style="padding:5px">Name:</span>
                    </td>
                    <td align="left">
                    ${content.name}
                    </td>
                </tr>
                <tr>
                    <td align="right">
                        <span style="padding:5px">Sendername:</span>
                    </td>
                    <td align="left">
                    ${senderName}
                    </td>
                </tr>
                <tr>
                    <td align="right">
                        <span style="padding:5px">Subject:</span>
                    </td>
                    <td align="left">
                    ${subject}
                    </td>
                </tr>
            </table>
            <div style="border: 1px solid #CCC;border-radius: 1px; padding: 3px; min-height: 40px; background-color: #FFF; margin: 10px;">${message}</div>
            
            <table style="width: 400px; margin: auto;">
                <tr>
                    <td align="center">
                        <a href="${apiEndpoint}/bat/${bat.uid}/${version.id}/validate?t=${encodeURIComponent(
        token
      )}" style=" cursor: pointer; text-decoration: none; width : 150px; color: #fff;border-radius: 3px; background-color: #2eb85c;border-color: #2eb85c;display: block;font-weight: normal;text-align: center;white-space: nowrap;vertical-align: middle;user-select: none;border: 1px solid transparent;padding: 0.5rem 1rem;font-size: 0.875rem;line-height: 1.25;transition: all 0.2s ease-in-out;">
                        Validate
                        </a>
                    </td>
                    <td align="center">
                        <a href="${apiEndpoint}/bat/${bat.uid}/${version.id}/validate?t=${encodeURIComponent(
        token
      )}" style="cursor: pointer;text-decoration: none; width : 150px; color: #fff;border-radius: 3px; background-color: #e55353;border-color: #e55353;display: block;font-weight: normal;text-align: center;white-space: nowrap;vertical-align: middle;user-select: none;border: 1px solid transparent;padding: 0.5rem 1rem;font-size: 0.875rem;line-height: 1.25;transition: all 0.2s ease-in-out;">
                        Reject
                        </a>
                    </td>
                </tr>
            </table>
      
      
    <div>
        `;
    }
  }

  async extractSenderConfigForContact(schedule, contact, sendingConfig = null, senderId) {
    if (!sendingConfig && schedule) {
      sendingConfig = await schedule.getSendingConfig();
    }

    if (!sendingConfig || !sendingConfig.config || !sendingConfig.config.espConfigs) {
      log.warn(`No sending config defined for schedule ${schedule.id}`);
      return null;
    }
    let espConfig = null;
    sendingConfig.config.espConfigs.forEach((espConfigElement) => {
      if (espConfigElement.default && !espConfig) {
        espConfig = espConfigElement;
      } else if (espConfigElement.esps.indexOf(contact.esp) >= 0) {
        espConfig = espConfigElement;
      }
    });
    if (!espConfig) {
      log.warn(`No config found for esp ${contact.esp} in schedule ${schedule.id}`);
      return null;
    }
    if (senderId) {
      let sender = espConfig.senders.find((s) => {
        return s.senderId == senderId;
      });
      if (sender) {
        return sender;
      }
    }

    if (espConfig.senders.length == 1) {
      return espConfig.senders[0];
    } else if (espConfig.senders.length > 1) {
      var rand = Math.random() * 100;
      var count = 0;
      for (let sender of espConfig.senders) {
        if (sender.weight && sender.weight + count >= rand) {
          return sender;
        }
        count += sender.weight ? sender.weight : 0;
      }
      //nothing found. Take last one
      return espConfig.senders[espConfig.senders.length - 1];
    } else {
      log.warn(`No sender config found for esp ${contact.esp} in schedule ${schedule.id}`);
    }
    return null;
  }
};
