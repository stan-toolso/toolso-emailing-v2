/**
 * Couche de compatibilité toolso-media : conversion des requêtes et des réponses de l'API REST media
 * (backend/api/rest de toolso-media) vers le modèle v2. Les règles métier restent celles de la v2
 * (InscriptionService, ContactStatusService) ; seuls le format d'entrée et de sortie imitent media.
 */
const emailValidator = require('email-validator');

// Champs reconnus par media (DEFAULT_API_FIELDS de api/rest/contact/ContactUtil.js) et colonnes du contact media
const MEDIA_CONTACT_COLUMNS = ['firstname', 'lastname', 'zipcode', 'city', 'country', 'dob', 'gender', 'phone', 'street'];
// Champs de collecte : rattachés à l'inscription, jamais au contact
const COLLECT_FIELDS = ['collect_ip', 'collect_user_agent', 'collect_site_name', 'collect_url', 'ip', 'collectUrl'];

// statut v2 → email_status media (ContactEmailStatus de media)
const MEDIA_STATUS = {
  new: 'new',
  workable: 'active',
  unsub: 'unsub',
  complaint: 'complaint',
  hard_bounce: 'hard_bounce',
  archived: 'archived',
  blacklisted: 'blacklisted',
  removed: 'archived'
};

// codes d'erreur de l'inscription v2 → codes renvoyés par media (InscriptionService.onInscription de media)
const MEDIA_INSCRIPTION_ERROR = {
  esp_excluded: 'esp_excluded',
  email_pattern_excluded: 'esp_pattern_excluded',
  email_blacklisted: 'contact_blacklisted',
  contact_invalid: 'email_invalid'
};

const toMediaStatus = (status) => MEDIA_STATUS[status] ?? status ?? null;

const formatDob = (dob) => {
  if (!dob) {
    return null;
  }
  const d = dob instanceof Date ? dob : new Date(dob);
  return isNaN(d.getTime()) ? null : d.toISOString().substring(0, 10);
};

/** Champs personnalisés tels que media les renvoie (`contact.fields`), sans la provenance de la reprise. */
const mediaFields = (contact) => {
  const fields = { ...(contact.customFields ?? {}) };
  delete fields.media;
  delete fields.country;
  return fields;
};

/** contactToJSON de media, à partir d'un Contact v2. */
const contactToMediaJSON = (contact) => ({
  id: contact.id,
  email: contact.email,
  fields: mediaFields(contact),
  firstname: contact.firstname ?? null,
  lastname: contact.lastname ?? null,
  zipcode: contact.zipcode ?? null,
  city: contact.city ?? null,
  country: contact.customFields?.country ?? null,
  phone: contact.phone ?? null,
  street: contact.street ?? null,
  gender: contact.gender ?? null,
  dob: formatDob(contact.dob),
  esp: contact.esp ?? null,
  email_status: toMediaStatus(contact.status),
  pixel_tracking_consent: contact.pixelTrackingConsent ?? null,
  md5: contact.md5 ?? null,
  sha1: contact.sha1 ?? null,
  sha256: contact.sha256 ?? null,
  created_at: contact.createdAt ?? null,
  updated_at: contact.updatedAt ?? null
});

/**
 * validatePayload de media pour la route produit (storeInCustomFields) : e-mail obligatoire et valide,
 * tous les autres champs du corps sont conservés.
 * @returns {{ email: string|null, errors: object[] }}
 */
const validateMediaEmail = (payload) => {
  const errors = [];
  let email = null;
  if (!payload || !payload.email) {
    errors.push({ field: 'email', message: 'Required field' });
  } else {
    email = String(payload.email).trim().toLowerCase();
    if (!emailValidator.validate(email)) {
      errors.push({ field: 'email', message: 'Email is invalid' });
    }
  }
  return { email, errors };
};

/**
 * Sépare un corps d'inscription media en champs du contact (format attendu par ContactService.mergeFieldsInContact)
 * et données de collecte. Comme media, l'objet `fields` imbriqué est fusionné dans les champs personnalisés.
 */
const splitInscriptionPayload = (payload) => {
  const body = { ...(payload ?? {}) };
  const collect = {
    ip: body.collect_ip ?? body.ip ?? null,
    collectUrl: body.collect_url ?? body.collectUrl ?? null,
    userAgent: body.collect_user_agent ?? null,
    siteName: body.collect_site_name ?? null
  };
  for (const key of [...COLLECT_FIELDS, 'email', 'apikey', 'source_name', 'source_id', 'skip_welcome_mail']) {
    delete body[key];
  }
  const fields = {};
  for (const key in body) {
    if (key === 'fields') {
      if (body.fields && typeof body.fields === 'object' && !Array.isArray(body.fields)) {
        Object.assign(fields, body.fields);
      }
    } else if (key === 'gender') {
      fields.gender = normalizeGender(body.gender);
    } else if (key === 'dob') {
      if (body.dob) {
        fields.dob = body.dob;
      }
    } else if (body[key] !== undefined) {
      fields[key] = body[key];
    }
  }
  delete fields.media;
  return { fields, collect };
};

const normalizeGender = (gender) => {
  if (typeof gender !== 'string') {
    return null;
  }
  const g = gender.trim().toLowerCase();
  if (/^(m|h|male|homme|mr|monsieur|1)$/.test(g)) {
    return 'm';
  }
  if (/^(f|w|female|femme|mme|mrs|ms|madame|2)$/.test(g)) {
    return 'f';
  }
  return null;
};

/** Erreur d'inscription v2 au format media : `{ code, message, field }`. */
const toMediaInscriptionError = (errorCode, message) => ({
  code: MEDIA_INSCRIPTION_ERROR[errorCode] ?? errorCode ?? 'inscription_refused',
  message: message ?? null,
  field: 'email'
});

/**
 * uid des produits media servis par cette instance (routes /v1/:product_uid/…) : MEDIA_PRODUCT_UIDS
 * (liste séparée par des virgules), à défaut RESOURCE_UID.
 */
const allowedProductUids = () =>
  (process.env.MEDIA_PRODUCT_UIDS || process.env.RESOURCE_UID || '')
    .split(',')
    .map((uid) => uid.trim().toLowerCase())
    .filter(Boolean);

/** Colonne exportable (paramètre `fields` de GET /v1/contacts/export) → valeur, à partir du JSON media du contact. */
const exportValue = (json, field) => {
  if (field.startsWith('fields.')) {
    return json.fields?.[field.substring(7)] ?? null;
  }
  return field in json ? json[field] : json.fields?.[field] ?? null;
};

module.exports = {
  MEDIA_CONTACT_COLUMNS,
  toMediaStatus,
  contactToMediaJSON,
  validateMediaEmail,
  splitInscriptionPayload,
  normalizeGender,
  toMediaInscriptionError,
  allowedProductUids,
  exportValue
};
