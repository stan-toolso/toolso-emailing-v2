const express = require('express');
const CryptoJS = require('crypto-js');
const log = require('../../util/log').getLogger('Tracking');
const fetch = require('../../infra/getNodeFetch')();
const config = require('../../util/config');
const ActionService = require('../../services/ActionService');
const ActionType = require('../../services/ActionType');
const MirrorService = require('../../services/MirrorService');

/**
 * Routes de tracking, de désabonnement et page miroir : reprise des Lambdas `tracking_api` (lk.<domaine>) et
 * `mirror_api`. Les événements sont poussés dans la file d'actions locale (`track_event`) au lieu de SQS.
 */

const TRANSPARENT_GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAAAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64');

let _actionService = null;
const actionService = () => _actionService ?? (_actionService = new ActionService());
let _mirrorService = null;
const mirrorService = () => _mirrorService ?? (_mirrorService = new MirrorService());

function isMobileUserAgent(userAgent) {
  return userAgent && /Android|iPhone/i.test(userAgent);
}

const subCountryCodes = {
  FR: ['FR', 'RE', 'MQ', 'YT', 'NC', 'PF', 'BL', 'MF', 'PM', 'TF', 'WF'],
  NL: ['NL', 'AW', 'BQ', 'CW', 'SX']
};

function isCountryOk(ipInfo, expectedCountry) {
  if (!ipInfo) {
    return true;
  }
  if (subCountryCodes[expectedCountry]) {
    return subCountryCodes[expectedCountry].includes(ipInfo.country ?? ipInfo.countryCode);
  }
  return (ipInfo.country ?? ipInfo.countryCode) === expectedCountry;
}

function isClickAccepted(protectionLevel, clickQualityScore, ipInfo, userAgent, expectedCountry) {
  if (protectionLevel == 5) {
    return false;
  }
  if (!protectionLevel) {
    return true;
  }
  let countryOk = isCountryOk(ipInfo, expectedCountry);
  let isMobile = isMobileUserAgent(userAgent) && (ipInfo?.mobile ?? true);
  let isProxy = ipInfo?.proxy ?? false;

  if (protectionLevel == 4) {
    return countryOk && !isProxy && (clickQualityScore >= 90 || (isMobile && clickQualityScore >= 70));
  }
  if (protectionLevel == 3) {
    return !isProxy && (clickQualityScore >= 85 || (isMobile && clickQualityScore >= 65));
  }
  if (protectionLevel == 2) {
    return !isProxy && (clickQualityScore >= 80 || (isMobile && clickQualityScore >= 60));
  }
  if (protectionLevel == 1) {
    return !isProxy && (countryOk || clickQualityScore >= 70 || (isMobile && clickQualityScore >= 50));
  }
  return true;
}

const clientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return `${forwarded}`.split(',')[0].trim();
  }
  return req.socket.remoteAddress;
};

const decrypt = (encrypted, secretKey) => {
  const decrypted = CryptoJS.AES.decrypt(encrypted, secretKey).toString(CryptoJS.enc.Utf8);
  return JSON.parse(decrypted);
};

const pushTrackEvent = async (event) => {
  try {
    await actionService().newAction(ActionType.track_event, event);
  } catch (err) {
    log.error('Failed to push track event', err);
  }
};

const getIpInfo = async (ipAddress) => {
  const key = config.ipApiKey();
  if (!key) {
    return null;
  }
  try {
    const response = await fetch(`https://pro.ip-api.com/json/${ipAddress}?key=${key}&fields=status,message,countryCode,region,regionName,city,zip,timezone,isp,org,as,mobile,proxy,hosting`);
    const info = await response.json();
    // la v1 lisait `country` : on garde les deux noms
    if (info && info.countryCode && !info.country) {
      info.country = info.countryCode;
    }
    return info;
  } catch (err) {
    log.error('Failed to get ip info', err);
    return null;
  }
};

const router = express.Router();

/** Lien tracké simple : redirection (aussi utilisé pour les images quand un domaine de tracking est configuré). */
router.get('/tk/v1/:secretKey/:encryptedLink', async (req, res) => {
  const secretKey = req.params.secretKey;
  try {
    const encryptedLink = decodeURIComponent(req.params.encryptedLink);
    const decryptedLink = CryptoJS.AES.decrypt(encryptedLink, secretKey).toString(CryptoJS.enc.Utf8);
    if (decryptedLink) {
      res.redirect(decryptedLink);
      return;
    }
  } catch (ex) {
    log.error(`TK Failed to decrypt link ${secretKey}, ${req.params.encryptedLink}.`, ex);
  }
  res.status(404).send('Not found');
});

/** Clic tracké avec protection anti-robot optionnelle. */
router.get('/tkc/v1/:secretKey/:encryptedObj', async (req, res) => {
  const secretKey = req.params.secretKey;
  let encryptedObj = null;
  try {
    encryptedObj = decodeURIComponent(req.params.encryptedObj).replace(/ /g, '');
    const decryptedObj = decrypt(encryptedObj, secretKey);
    const ipAddress = clientIp(req);
    const userAgent = req.headers['user-agent'];
    const timestamp = new Date();

    // Page de validation (captcha) : en v1 sur lk.toolso.io ; ici sur l'hôte de validation (ou le même hôte) avec ?validate=1
    const isValidationPage = req.query.validate !== undefined || (config.clickValidationHost() && `${req.protocol}://${req.get('host')}` === config.clickValidationHost());
    if (isValidationPage) {
      if (req.query.gc) {
        let success = false;
        if (config.recaptchaSecret()) {
          const body = new URLSearchParams();
          body.append('secret', config.recaptchaSecret());
          body.append('response', req.query.gc);
          const response = await fetch(`https://www.google.com/recaptcha/api/siteverify`, { method: 'POST', body });
          const gcResponse = await response.json();
          success = gcResponse.success == true;
        } else {
          log.warn('RECAPTCHA_SECRET not configured: click validation accepted without verification');
          success = true;
        }
        if (success) {
          await pushTrackEvent({ ...decryptedObj, timestamp, eventType: 'ClickValidationChecked', userAgent, ipAddress });
          res.redirect(decryptedObj.href);
        } else {
          res.redirect(`${req.path}?validate=1`);
        }
        return;
      }
      const ln = decryptedObj.ln ? decryptedObj.ln : 'en';
      res.render(`tracking/validation/${['fr', 'en', 'de'].includes(ln) ? ln : 'en'}`, { recaptchaSiteKey: config.recaptchaSiteKey() ?? '' });
      return;
    }

    let accepted = true;
    let ipInfo = null;
    const protectionLevel = decryptedObj.pl;
    if (protectionLevel) {
      ipInfo = await getIpInfo(ipAddress);
      accepted = isClickAccepted(protectionLevel, decryptedObj.cql, ipInfo, userAgent, decryptedObj.ecc);
    }

    if (!decryptedObj.noTrack) {
      await pushTrackEvent({ ...decryptedObj, timestamp, eventType: 'Click', userAgent, ipAddress, accepted, ipInfo });
    }
    if (decryptedObj.unsub) {
      await pushTrackEvent({ ...decryptedObj, timestamp, eventType: 'Unsub', userAgent, ipAddress });
    } else if (!accepted) {
      await pushTrackEvent({ ...decryptedObj, timestamp, eventType: 'ClickValidationAsked', userAgent, ipAddress, ipInfo });
      const validationBase = config.clickValidationHost() || '';
      res.redirect(`${validationBase}${req.originalUrl}${req.originalUrl.indexOf('?') >= 0 ? '&' : '?'}validate=1`);
      return;
    }

    if (!decryptedObj.href || decryptedObj.href.indexOf('#') === 0) {
      res.sendStatus(404);
      return;
    }
    res.redirect(decryptedObj.href);
    return;
  } catch (ex) {
    log.error(`TKC Failed to decrypt link ${secretKey}, ${encryptedObj}.`, ex);
  }
  res.status(404).send('Not found');
});

/** Pixel d'ouverture. */
router.get('/tko/v1/:secretKey/:encryptedObj', async (req, res) => {
  const secretKey = req.params.secretKey;
  try {
    const decryptedObj = decrypt(decodeURIComponent(req.params.encryptedObj), secretKey);
    await pushTrackEvent({
      ...decryptedObj,
      userAgent: req.headers['user-agent'],
      ipAddress: clientIp(req),
      timestamp: new Date(),
      eventType: 'Open'
    });
    res.set({ 'Content-Type': 'image/gif', 'Cache-Control': 'no-store, no-cache, must-revalidate, private' });
    res.status(200).send(TRANSPARENT_GIF);
    return;
  } catch (ex) {
    log.error(`Failed to decrypt open pixel ${secretKey}, ${req.params.encryptedObj}`, ex);
  }
  res.status(404).send('Not found');
});

/** Page de désabonnement (GET : confirmation, POST ou ?oneclick : désabonnement effectif). */
const unsub = async (req, res) => {
  const secretKey = req.params.secretKey;
  let decryptedObject = null;
  try {
    decryptedObject = decrypt(decodeURIComponent(req.params.encryptedObject), secretKey);
  } catch (ex) {
    log.error(`Failed to decrypt unsub link ${secretKey}, ${req.params.encryptedObject}.`, ex);
    res.status(404).send('Not found');
    return;
  }
  log.debug('Unsub request for ' + JSON.stringify(decryptedObject));
  const oneclick = req.query && req.query.oneclick;

  if (oneclick || (req.body && req.body.unsub)) {
    decryptedObject.success = true;
    let messageId = decryptedObject.messageId ?? null;
    if (!messageId && decryptedObject.mirrorId) {
      messageId = await mirrorService().getMessageId(decryptedObject.mirrorId);
    }
    await actionService().newAction(ActionType.insert_contact_event, {
      email: decryptedObject.email,
      eventType: 'unsub',
      ts: new Date().getTime(),
      messageId,
      details: {
        oneclick
      }
    });
  }
  const ln = ['fr', 'de'].includes(req.params.ln) ? req.params.ln : 'fr';
  res.render(`tracking/unsub/${ln}`, decryptedObject);
};
router.get('/unsub/:ln/:secretKey/:encryptedObject', unsub);
router.post('/unsub/:ln/:secretKey/:encryptedObject', express.urlencoded({ extended: true }), unsub);

/** Page miroir (« voir en ligne »). */
router.get('/m/:mirrorId', async (req, res) => {
  const mirrorId = req.params.mirrorId;
  if (mirrorId === 'favicon.ico') {
    res.send('');
    return;
  }
  try {
    const body = await mirrorService().getBody(mirrorId);
    res.setHeader('content-type', 'text/html; charset=utf-8');
    if (body) {
      res.send(body);
    } else {
      res.status(404).send('Not found');
    }
  } catch (err) {
    log.error(`Failed to render mirror ${mirrorId}`, err);
    res.status(500).send('Error');
  }
});

module.exports = { router, isClickAccepted, isCountryOk };
