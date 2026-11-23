/**
 * API de transition toolso-media → v2 : mêmes routes, mêmes clés et mêmes réponses que l'API REST de media
 * (`/v1/…` de backend/bin/api.js), traduites vers les services de l'instance.
 *
 * Servie sous `/api/<uid>/v1/…` (ou à la racine d'un domaine de suivi) : pour basculer, un appelant remplace seulement
 * la base de l'URL, `https://<api media>/v1/<produit>/contacts/` → `https://<serveur>/api/<uid>/v1/<produit>/contacts/`.
 * Le relais côté media (transfert des appels d'un produit basculé) appelle les mêmes routes.
 *
 * Authentification, comme media :
 * - routes produit (`/v1/:product_uid/…`, `/v1/contacts/export`) : clé d'API (`ApiKey`, en-tête apikey / api-key,
 *   reprise de la table media `api_key`) ou jeton de l'interface ; sinon `{ status: 'ko', code: 'unauthorized' }` ;
 * - routes source (`/v1/source/…`) : clé de la source (`ContactSource.apiKey`, en-tête ou corps `apikey`).
 */
const express = require('express');
const moment = require('moment-timezone');
const log = require('../../util/log').getLogger('MediaCompat');
const sequelize = require('../../storage/sequelize');
const EventType = require('../../storage/models/EventType');
const { contactToMediaJSON, validateMediaEmail, splitInscriptionPayload, toMediaInscriptionError, allowedProductUids, exportValue } = require('./mediaCompat');

let _services = null;
const services = () => {
  if (!_services) {
    const InscriptionService = require('../../services/InscriptionService');
    const ContactService = require('../../services/ContactService');
    const ContactStatusService = require('../../services/ContactStatusService');
    const ContactEventService = require('../../services/ContactEventService');
    const SourceService = require('../../services/SourceService');
    const HistoryService = require('../../services/HistoryService');
    _services = {
      inscription: new InscriptionService(),
      contact: new ContactService(),
      contactStatus: new ContactStatusService(),
      contactEvent: new ContactEventService(),
      source: new SourceService(),
      history: new HistoryService()
    };
  }
  return _services;
};

const wrap = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (err) {
    log.error(`${req.method} ${req.originalUrl} a échoué : ${err.message}`, err);
    if (!res.headersSent) {
      res.status(500).json({ status: 'ko', code: 'internal_error', message: 'Internal error' });
    }
  }
};

// ---------- filtres d'accès (userFilter, productFilter, sourceFilter de media) ----------

const userFilter = (req, res, next) => {
  if (!req.token) {
    res.json({ status: 'ko', code: 'unauthorized' });
    return;
  }
  next();
};

const productFilter = (req, res, next) => {
  const uid = String(req.params.product_uid || '').toLowerCase();
  if (!uid || !allowedProductUids().includes(uid)) {
    res.json({ status: 'ko', code: 'unauthorized' });
    return;
  }
  next();
};

const sourceFilter = async (req, res, next) => {
  try {
    let apiKey = req.get('apikey');
    if (!apiKey && req.body && 'apikey' in req.body) {
      apiKey = req.body.apikey;
    }
    if (!apiKey) {
      res.json({ status: 'ko', code: 'no_api_key', message: 'No api key provided. Please provide an apikey in the header or in the body of the request.' });
      return;
    }
    const source = await services().source.getSourceFromApiKey(apiKey);
    if (!source) {
      res.json({ status: 'ko', code: 'invalid_api_key', message: 'Invalid api key.' });
      return;
    }
    req.source = source;
  } catch (err) {
    log.error(`Recherche de la source a échoué : ${err.message}`, err);
    res.status(500).json({ status: 'ko', code: 'internal_error', message: 'Internal error' });
    return;
  }
  next();
};

// ---------- validation des champs d'une source (validatePayload de media avec api_fields) ----------

const LETTERS = RegExp("^[a-zA-ZàáâäãåąčćęèéêëėįìíîïłńòóôöõøùúûüųūÿýżźñçčšžÀÁÂÄÃÅĄĆČĖĘÈÉÊËÌÍÎÏĮŁŃÒÓÔÖÕØÙÚÛÜŲŪŸÝŻŹÑßÇŒÆČŠŽ∂ð ,.'-]+$");

const validateSourcePayload = (payload, apiFields, ignoreRequired) => {
  const { email, errors } = validateMediaEmail(payload);
  const fields = {};
  const isIp = require('is-ip');
  const validUrl = require('valid-url');
  for (const field in apiFields ?? {}) {
    const config = apiFields[field] ?? {};
    if (!config.enabled) {
      continue;
    }
    if (config.type === 'manual') {
      fields[field] = config.value;
      continue;
    }
    const value = payload?.[field];
    if (value) {
      for (const validator of config.validators ?? []) {
        if (validator.type === 'only_letter_validation' && !LETTERS.test(value)) {
          errors.push({ field, message: 'Must contain only letters' });
        } else if (validator.type === 'url_validation' && !validUrl.isUri(value)) {
          errors.push({ field, message: 'Invalid URL' });
        } else if (validator.type === 'ip_validation' && !isIp(value)) {
          errors.push({ field, message: 'Invalid IP' });
        }
      }
      fields[field] = value;
    } else if (config.required && !ignoreRequired) {
      errors.push({ field, message: 'Required fields' });
    }
  }
  return { email, fields, errors };
};

// ---------- contrôles avant inscription (sans écriture) ----------

const checkEmailAcceptable = async (email, source) => {
  const { filterEsp } = require('../../services/inscription_filters/EspFilter');
  const { filterEmailPatterns } = require('../../services/inscription_filters/EmailFilter');
  const { filterBlacklist } = require('../../services/inscription_filters/BacklistFilter');
  if (!filterEsp(email)) {
    return [{ code: 'esp_excluded', message: 'Esp is excluded', field: 'email' }];
  }
  if (!filterEmailPatterns(email)) {
    return [{ code: 'esp_pattern_excluded', message: 'Esp pattern is excluded', field: 'email' }];
  }
  if (!(await filterBlacklist(email))) {
    return [{ code: 'contact_blacklisted', message: 'Contact is blacklisted', field: 'email' }];
  }
  if (source) {
    const { validateApiSettings } = require('../expressResolvers/source/SourceUtil');
    const result = validateApiSettings(email, source);
    if (!result.accepted) {
      return [{ code: 'esp_excluded', message: result.errors?.[0]?.message ?? 'Esp is excluded' }];
    }
  }
  return [];
};

// ---------- source de l'inscription (route produit) ----------

const resolveSource = async (payload) => {
  const { ContactSource } = sequelize.get().models;
  const name = typeof payload.source_name === 'string' ? payload.source_name.trim() : '';
  if (!name) {
    return null;
  }
  // media : source du produit dont l'utm_source vaut source_name (sans casse), créée sinon
  let source = await ContactSource.findOne({ where: { utmSource: { [require('sequelize').Op.iLike]: name } } });
  if (!source) {
    source = await ContactSource.create({ name, utmSource: name });
  }
  return source;
};

// ---------- routes ----------

const router = express.Router();

// POST /v1/:product_uid/contacts/ — inscription (route la plus appelée)
const postContact = wrap(async (req, res) => {
  const payload = req.body ?? {};
  const { email, errors } = validateMediaEmail(payload);
  if (errors.length > 0) {
    res.json({ status: 'ko', code: 'invalid_payload', message: 'The payload is invalid.', errors });
    return;
  }
  const { fields, collect } = splitInscriptionPayload(payload);
  const source = await resolveSource(payload);
  const s = services();
  const result = source
    ? await s.inscription.createContactInscriptionForSource(email, fields, collect.ip, collect.collectUrl, source)
    : await s.inscription.createContactInscription(email, fields, collect.ip, collect.collectUrl, null);
  if (!result.success || !result.inscription) {
    res.json({ status: 'ko', code: 'inscription_refused', errors: [toMediaInscriptionError(result.errorCode, result.message)] });
    return;
  }
  const contact = await s.contact.findWithId(result.inscription.contactId);
  res.json({ status: 'ok', code: 'contact_accepted', contact: contactToMediaJSON(contact) });
});

// GET /v1/:product_uid/contacts/check — l'e-mail serait-il accepté ?
const getCheck = wrap(async (req, res) => {
  const { email, errors } = validateMediaEmail(req.query);
  if (errors.length > 0) {
    res.json({ status: 'ko', code: 'invalid_payload', message: 'The payload is invalid.', errors });
    return;
  }
  const refused = await checkEmailAcceptable(email, null);
  if (refused.length > 0) {
    res.json({ status: 'ko', code: 'inscription_refused', errors: refused });
    return;
  }
  res.json({ status: 'ok', code: 'inscription_acceptable' });
});

// GET /v1/:product_uid/contacts/:email
const getContact = wrap(async (req, res) => {
  const contact = await services().contact.findWithEmail(decodeURIComponent(req.params.email));
  if (!contact) {
    res.json({ status: 'ko', code: 'contact_not_found', message: 'Contact not found' });
    return;
  }
  res.json(contactToMediaJSON(contact));
});

// DELETE /v1/:product_uid/contacts/ — suppression définitive (corps { email })
const deleteContact = wrap(async (req, res) => {
  const email = req.body?.email ?? req.query?.email;
  const removed = typeof email === 'string' ? await services().contact.removeContactWithEmail(email) : null;
  if (!removed) {
    res.json({ status: 'ko', code: 'contact_not_found', message: 'Contact not found' });
    return;
  }
  res.json({ status: 'ok' });
});

// POST /v1/:product_uid/unsubscriptions/ — désabonnement (corps { email, email_id?, reason?, user_agent?, ip? })
const postUnsub = wrap(async (req, res) => {
  const s = services();
  const body = req.body ?? {};
  const contact = await s.contact.findWithEmail(body.email);
  if (!contact) {
    res.json({ status: 'ko', message: 'Contact not found' });
    return;
  }
  await s.contactEvent.insertNewEvent(contact.email, EventType.unsub, new Date(), null, body.ip ?? null, null, null, null, null, contact.lastInscriptionId, {
    origin: 'Rest API',
    email_id: body.email_id ?? null,
    reason: body.reason ?? null,
    user_agent: body.user_agent ?? null,
    ip: body.ip ?? null
  });
  await s.contactStatus.updateContactStatus(contact);
  res.json({ status: 'ok' });
});

// POST /v1/:product_uid/contacts/pixel_tracking_consent
const postPixelTrackingConsent = wrap(async (req, res) => {
  const { email, pixel_tracking_consent, date, source } = req.body ?? {};
  const errors = [];
  if (typeof pixel_tracking_consent !== 'boolean') {
    errors.push({ field: 'pixel_tracking_consent', message: 'Required field, must be a boolean' });
  }
  if (!email) {
    errors.push({ field: 'email', message: 'Required field' });
  }
  const historyDate = date ? new Date(date) : new Date();
  if (isNaN(historyDate.getTime())) {
    errors.push({ field: 'date', message: 'Invalid date' });
  }
  if (errors.length > 0) {
    res.json({ status: 'ko', code: 'invalid_payload', message: 'The payload is invalid.', errors });
    return;
  }
  const s = services();
  const contact = await s.contact.findWithEmail(email);
  if (!contact) {
    res.json({ status: 'ko', code: 'contact_not_found', message: 'Contact not found' });
    return;
  }
  contact.pixelTrackingConsent = pixel_tracking_consent;
  await contact.save();
  await s.history.createHistory('Rest API', { pixel_tracking_consent, source: source ?? null, date: historyDate }, 'pixel_tracking_consent_update', 'contact', contact.id, 1);
  res.json({ status: 'ok', code: 'pixel_tracking_consent_updated', contact: contactToMediaJSON(contact) });
});

// POST /v1/source/contacts/ — inscription par la clé d'une source
const sourcePostContact = wrap(async (req, res) => {
  const source = req.source;
  if (!source.apiEnabled) {
    res.json({ status: 'ko', code: 'campaign_disabled', message: 'This campaign is currently disabled.' });
    return;
  }
  const payload = req.body ?? {};
  const { email, fields: validated, errors } = validateSourcePayload(payload, source.apiFields ?? undefined, false);
  if (errors.length > 0) {
    res.json({ status: 'ko', code: 'invalid_payload', message: 'The payload is invalid.', errors });
    return;
  }
  const { fields, collect } = splitInscriptionPayload({ ...validated, email, collect_ip: payload.collect_ip ?? validated.ip, collect_url: payload.collect_url ?? validated.collectUrl });
  const result = await services().inscription.createContactInscriptionForSource(email, fields, collect.ip, collect.collectUrl, source);
  if (!result.success || !result.inscription) {
    res.json({ status: 'ko', code: 'inscription_refused', errors: [toMediaInscriptionError(result.errorCode, result.message)] });
    return;
  }
  res.json({ status: 'ok', code: 'contact_accepted' });
});

// GET /v1/source/contacts/check
const sourceGetCheck = wrap(async (req, res) => {
  const source = req.source;
  if (!source.apiEnabled) {
    res.json({ status: 'ko', code: 'campaign_disabled', message: 'This campaign is currently disabled.' });
    return;
  }
  const { email, errors } = validateSourcePayload(req.query ?? {}, source.apiFields ?? undefined, true);
  if (errors.length > 0) {
    res.json({ status: 'ko', code: 'invalid_payload', message: 'The payload is invalid.', errors });
    return;
  }
  const refused = await checkEmailAcceptable(email, source);
  if (refused.length > 0) {
    res.json({ status: 'ko', code: 'inscription_refused', errors: refused });
    return;
  }
  res.json({ status: 'ok', code: 'inscription_acceptable' });
});

// GET /v1/contacts/export?fields=email,firstname&unique_fields=…&filter={…} — CSV de tous les contacts de l'instance.
// Le filtre media (arbre de critères) n'est pas traduit : seul le périmètre produit (product_id / productIds) est accepté,
// l'instance ne contenant qu'un produit.
const PRODUCT_SCOPE_KEYS = ['product_id', 'productIds'];
const exportContacts = wrap(async (req, res) => {
  let filter;
  try {
    filter = JSON.parse(req.query.filter ?? '{}') ?? {};
  } catch (e) {
    res.status(400).json({ status: 'ko', code: 'invalid_filter', message: 'filter must be a JSON object' });
    return;
  }
  const unsupported = Object.keys(filter).filter((key) => !PRODUCT_SCOPE_KEYS.includes(key));
  if (unsupported.length > 0) {
    res.status(400).json({ status: 'ko', code: 'unsupported_filter', message: `Filter keys not supported during the transition: ${unsupported.join(', ')}` });
    return;
  }
  const fields = (req.query.fields ?? 'email')
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean);
  const uniqueFields = (req.query.unique_fields ?? '')
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean);
  const { Contact } = sequelize.get().models;
  const { Op } = require('sequelize');
  const rows = [];
  const seen = new Set();
  let lastId = 0;
  for (;;) {
    const batch = await Contact.findAll({ where: { id: { [Op.gt]: lastId } }, order: [['id', 'ASC']], limit: 5000 });
    if (batch.length === 0) {
      break;
    }
    lastId = batch[batch.length - 1].id;
    for (const contact of batch) {
      const json = contactToMediaJSON(contact);
      if (uniqueFields.length > 0) {
        const key = JSON.stringify(uniqueFields.map((f) => exportValue(json, f)));
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
      }
      const row = {};
      for (const f of fields) {
        const value = exportValue(json, f);
        row[f] = value instanceof Date ? value.toISOString() : value;
      }
      rows.push(row);
    }
  }
  const { parseAsync } = require('json2csv');
  const content = rows.length > 0 ? await parseAsync(rows, { fields: fields.map((f) => ({ value: f, label: f })), delimiter: ',' }) : fields.map((f) => `"${f}"`).join(',');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=${moment().format('YYYY-MM-DD')}_${process.env.RESOURCE_UID}_contacts.csv`);
  res.send(content);
});

// POST /v1/ad/click/conversion — les conversions concernent les publicités media (tsclid, base ads commune) :
// transférées telles quelles à media (MEDIA_CONVERSION_URL), jamais traitées ici.
const postClickConversion = wrap(async (req, res) => {
  const payload = req.body ?? {};
  if (!payload.tsclid) {
    res.status(400).json({ status: 'error', code: 'no_tsclid' });
    return;
  }
  const target = process.env.MEDIA_CONVERSION_URL;
  if (!target) {
    log.warn(`Conversion reçue sans MEDIA_CONVERSION_URL : ignorée (${JSON.stringify(payload)})`);
    res.status(503).json({ status: 'ko', code: 'conversion_relay_disabled' });
    return;
  }
  const fetch = require('../../infra/getNodeFetch')();
  const response = await fetch(target, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), timeout: 10000 });
  res
    .status(response.status)
    .type(response.headers.get('content-type') || 'application/json')
    .send(await response.text());
});

router.post('/ad/click/conversion', postClickConversion);
router.get('/contacts/export', userFilter, exportContacts);
router.post('/source/contacts/', sourceFilter, sourcePostContact);
router.get('/source/contacts/check', sourceFilter, sourceGetCheck);
router.post('/:product_uid/contacts/', userFilter, productFilter, postContact);
router.post('/:product_uid/contacts/pixel_tracking_consent', userFilter, productFilter, postPixelTrackingConsent);
router.get('/:product_uid/contacts/check', userFilter, productFilter, getCheck);
router.get('/:product_uid/contacts/:email', userFilter, productFilter, getContact);
router.delete('/:product_uid/contacts/', userFilter, productFilter, deleteContact);
router.post('/:product_uid/unsubscriptions/', userFilter, productFilter, postUnsub);

module.exports = { router };
