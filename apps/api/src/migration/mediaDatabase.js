const { Client } = require('pg');
const moment = require('moment-timezone');
const emailValidator = require('email-validator');
const md5 = require('md5');
const sha1 = require('sha1');
const sha256 = require('js-sha256');
const { Op, QueryTypes } = require('sequelize');
const { extractEsp } = require('../services/EspService');
const ContactStatus = require('../storage/models/ContactStatus');
const EventType = require('../storage/models/EventType');
const log = require('../util/log').getLogger('MediaMigration');

/**
 * Reprise d'une base toolso-media (https://gitlab.com/toolso/toolso-media, PostgreSQL, un `product` = un média avec ses
 * contacts) dans la base emailing de l'instance (une base par instance).
 *
 * Source (schéma media, tables lues en SELECT seulement) → cible (modèles Sequelize de apps/api) :
 *   product                      → choix du ou des produits à reprendre (un produit media ≈ une base emailing)
 *   contact_source (du produit)  → ContactSource (réutilisée si une source du même nom existe déjà)
 *   contact (du produit)         → Contact (statut, activation, stats « vie entière », scores, champs personnalisés)
 *   inscription                  → ContactInscription (une inscription synthétique quand le contact n'en a aucune :
 *                                  la v2 supprime les contacts sans inscription)
 *   email (envois récents)       → ContactEvent (request, open, click, proxy_loaded, bounces, unsub, complaint)
 *   contact_history              → ContactEvent des désabonnements, plaintes et bounces définitifs (toute la période)
 *                                  + ContactEvents (cache des événements, pour ne pas recompter les stats reprises)
 *   blacklisted_contact (global) → BlacklistedContact
 *   contact_message              → ContactMessage
 *
 * Le statut v2 est recalculé par le job scan_contact_to_update_status à partir des événements : les événements qui portent
 * le statut (unsub après la dernière inscription, complaint, hard_bounce) sont donc toujours créés, au besoin synthétisés à
 * la date du dernier changement de statut media. `nextStatusUpdateDate` est laissé vide pour que le job repasse sur chaque
 * contact repris.
 *
 * Non repris (listés par `inventory`) : expéditeurs (email_sender : identifiants ESP à ressaisir dans l'UI), configurations
 * d'envoi, contenus, gabarits, slots, articles, stats agrégées, utilisateurs, paramètres.
 *
 * Idempotent : un contact dont l'e-mail existe déjà dans la cible est ignoré (avec ses inscriptions et événements) ; les
 * sources sont retrouvées par nom, la blacklist par empreinte.
 */

const DEFAULT_BATCH_SIZE = 1000;
const DEFAULT_SINCE_DAYS = 90;
const DEFAULT_TIMEZONE = 'Europe/Paris';

/** email_status media → ContactStatus v2 */
const STATUS_MAPPING = Object.freeze({
  new: ContactStatus.new,
  active: ContactStatus.workable,
  unsub: ContactStatus.unsub,
  complaint: ContactStatus.complaint,
  hard_bounce: ContactStatus.hard_bounce,
  contact_bounce: ContactStatus.archived,
  archived: ContactStatus.archived,
  blacklisted: ContactStatus.blacklisted
});

/** type contact_history media → EventType v2 (événements porteurs de statut, repris sur toute la période) */
const HISTORY_EVENT_TYPES = Object.freeze({
  emailing_unsub: EventType.unsub,
  emailing_complaint: EventType.complaint,
  emailing_hard_bounce: EventType.hard_bounce,
  emailing_contact_bounce: EventType.contact_bounce
});

/** colonnes booléennes de `email` media → EventType v2 */
const EMAIL_FLAG_EVENTS = Object.freeze([
  ['opened', EventType.open],
  ['proxy_loaded', EventType.proxy_loaded],
  ['clicked', EventType.click],
  ['soft_bounced', EventType.soft_bounce],
  ['contact_bounced', EventType.contact_bounce],
  ['content_bounced', EventType.content_bounce],
  ['hard_bounced', EventType.hard_bounce],
  ['unsubcribed', EventType.unsub],
  ['complainted', EventType.complaint]
]);
const UNIQUE_EVENT_TYPES = new Set([EventType.open, EventType.click, EventType.proxy_loaded]);
const STATUS_EVENT_OF = Object.freeze({
  [ContactStatus.unsub]: EventType.unsub,
  [ContactStatus.complaint]: EventType.complaint,
  [ContactStatus.hard_bounce]: EventType.hard_bounce
});

const CONTACT_FIELDS = ['firstname', 'lastname', 'street', 'zipcode', 'city', 'phone'];

const normalizeEmail = (email) => {
  if (typeof email !== 'string') {
    return null;
  }
  email = email.trim().toLowerCase();
  if (!email || email.indexOf('{') >= 0 || !emailValidator.validate(email)) {
    return null;
  }
  return email;
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

const normalizeDob = (dob) => {
  if (!dob) {
    return null;
  }
  const m = moment(dob, ['YYYY-MM-DD', moment.ISO_8601], true);
  return m.isValid() ? m.format('YYYY-MM-DD') : null;
};

const toDate = (value) => {
  if (!value) {
    return null;
  }
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? null : d;
};

const truncate = (value, max) => (typeof value === 'string' && value.length > max ? value.slice(0, max) : value ?? null);

const emailingStats = (stats) => (stats && typeof stats === 'object' && stats.emailing && typeof stats.emailing === 'object' ? { ...stats.emailing } : null);

const hasActivity = (stats) => !!stats && ((stats.open ?? 0) > 0 || (stats.click ?? 0) > 0 || (stats.proxy_loaded ?? 0) > 0);

/** Ouvre une connexion pg vers la base media (lecture seule : seules des requêtes SELECT sont émises). */
const openSource = async (sourceUrl) => {
  const client = new Client({ connectionString: sourceUrl, application_name: 'toolso-emailing-v2 migrate-from-media' });
  await client.connect();
  await client.query('SET default_transaction_read_only = on');
  await client.query("SET statement_timeout = '0'");
  return client;
};

/** Produits de la base media avec le nombre de contacts. */
const listProducts = async (source) => {
  const { rows } = await source.query(
    `SELECT p.id, p.uid, p.name, p.disabled, p.main_domain, p.client_uid,
            (SELECT count(*) FROM contact c WHERE c.product_id = p.id)::int AS contacts
       FROM product p ORDER BY p.id`
  );
  return rows;
};

/** Résout --product (uid ou id, plusieurs possibles) ; sans sélection, le seul produit de la base. */
const resolveProducts = async (source, selection) => {
  const all = await listProducts(source);
  if (!selection || selection.length === 0) {
    if (all.length === 1) {
      return all;
    }
    throw new Error(`La base media contient ${all.length} produits : préciser lesquels reprendre (--product uid[,uid…]) : ${all.map((p) => `${p.uid} (#${p.id})`).join(', ')}`);
  }
  const products = [];
  for (const key of selection) {
    const k = String(key).trim();
    const product = all.find((p) => p.uid === k || String(p.id) === k);
    if (!product) {
      throw new Error(`Produit media inconnu : ${k} (produits : ${all.map((p) => p.uid).join(', ')})`);
    }
    if (!products.includes(product)) {
      products.push(product);
    }
  }
  return products;
};

/** Inventaire d'une base media pour les produits choisis (ce qui sera repris, ce qui ne l'est pas). */
const inventory = async (source, products, { sinceDays = DEFAULT_SINCE_DAYS } = {}) => {
  const ids = products.map((p) => p.id);
  const since = moment().subtract(sinceDays, 'days').toDate();
  const one = async (sql, params = []) => (await source.query(sql, params)).rows;
  const contactsByStatus = await one(`SELECT product_id, coalesce(email_status, 'new') AS email_status, count(*)::int AS n FROM contact WHERE product_id = ANY($1::int[]) GROUP BY 1, 2 ORDER BY 1, 2`, [ids]);
  const [counts] = await one(
    `SELECT (SELECT count(*) FROM contact WHERE product_id = ANY($1::int[]))::int AS contacts,
            (SELECT count(*) FROM inscription WHERE product_id = ANY($1::int[]))::int AS inscriptions,
            (SELECT count(*) FROM contact WHERE product_id = ANY($1::int[]) AND NOT EXISTS (SELECT 1 FROM inscription i WHERE i.contact_id = contact.id))::int AS contacts_without_inscription,
            (SELECT count(*) FROM contact_source WHERE product_id = ANY($1::int[]))::int AS sources,
            (SELECT count(*) FROM email WHERE product_id = ANY($1::int[]) AND sent_at >= $2)::int AS recent_emails,
            (SELECT count(*) FROM contact_history WHERE product_id = ANY($1::int[]) AND type = ANY($3::text[]))::int AS status_history,
            (SELECT count(*) FROM contact_message WHERE product_id = ANY($1::int[]))::int AS messages,
            (SELECT count(*) FROM blacklisted_contact)::int AS blacklisted,
            (SELECT count(*) FROM email_content WHERE product_id = ANY($1::int[]))::int AS contents,
            (SELECT count(*) FROM email_template WHERE product_id = ANY($1::int[]))::int AS templates,
            (SELECT count(*) FROM email_sending_config WHERE product_id = ANY($1::int[]))::int AS sending_configs,
            (SELECT count(*) FROM "user")::int AS users`,
    [ids, since, Object.keys(HISTORY_EVENT_TYPES)]
  );
  const senders = await one(`SELECT id, product_id, name, email, sender_name, router FROM email_sender WHERE product_id = ANY($1::int[]) ORDER BY id`, [ids]);
  const settings = await one(
    `SELECT product_id, name, value FROM settings WHERE (product_id = ANY($1::int[]) OR product_id IS NULL) AND name IN ('timezone', 'emailingUnsubUrl', 'espsMaxNewRequests', 'emailingRedirectionLink', 'clientUid', 'clientName', 'siteUrl') ORDER BY product_id NULLS FIRST, name`,
    [ids]
  );
  return { products, sinceDays, counts, contactsByStatus, senders, settings };
};

/**
 * Événements v2 d'un contact à partir de ses envois media récents et de son historique ; garantit l'événement qui porte le
 * statut media (unsub après la dernière inscription, complaint, hard_bounce).
 * @returns {{ events: Array<object>, guaranteed: number, lastRequestDate: Date|null }}
 */
const buildEvents = ({ contact, status, emails, history, lastInscriptionDate, esp }) => {
  const events = [];
  const keys = new Set();
  const push = (type, date, extra = {}) => {
    date = toDate(date);
    if (!date) {
      return false;
    }
    const key = `${type}|${date.toISOString().slice(0, 16)}`;
    if (keys.has(key)) {
      return false;
    }
    keys.add(key);
    events.push({ type, date, requestDate: extra.requestDate ?? date, messageId: extra.messageId ?? null, esp, isUnique: UNIQUE_EVENT_TYPES.has(type) ? true : null, details: extra.details ?? null });
    return true;
  };

  let lastRequestDate = null;
  for (const row of emails) {
    const sentAt = toDate(row.sent_at);
    if (!sentAt) {
      continue;
    }
    if (!lastRequestDate || sentAt > lastRequestDate) {
      lastRequestDate = sentAt;
    }
    const updatedAt = toDate(row.updated_at);
    const later = updatedAt && updatedAt > sentAt ? updatedAt : sentAt;
    push(EventType.request, sentAt, { messageId: row.message_id });
    for (const [flag, type] of EMAIL_FLAG_EVENTS) {
      if (!row[flag]) {
        continue;
      }
      const date = type === EventType.open ? toDate(row.opened_at) ?? later : later;
      push(type, date, { requestDate: sentAt, messageId: row.message_id, details: type === EventType.content_bounce ? { bounceSubType: 'ContentRejected' } : null });
    }
  }
  for (const row of history) {
    const type = HISTORY_EVENT_TYPES[row.type];
    if (type) {
      push(type, row.date ?? row.created_at, { details: row.details && typeof row.details === 'object' ? row.details : null });
    }
  }

  let guaranteed = 0;
  const statusType = STATUS_EVENT_OF[status];
  if (statusType) {
    const minDate = statusType === EventType.unsub && lastInscriptionDate ? lastInscriptionDate : null;
    const present = events.some((e) => e.type === statusType && (!minDate || e.date >= minDate));
    if (!present) {
      let date = toDate(contact.last_status_update) ?? toDate(contact.updated_at) ?? toDate(contact.created_at) ?? new Date();
      if (minDate && date <= minDate) {
        date = new Date(minDate.getTime() + 1000);
      }
      if (push(statusType, date, { details: { origin: 'toolso-media', reason: `email_status=${contact.email_status}` } })) {
        guaranteed++;
      }
    }
  }
  events.sort((a, b) => a.date - b.date);
  return { events, guaranteed, lastRequestDate };
};

const countsFromEvents = (events) => {
  const stats = {};
  for (const e of events) {
    stats[e.type] = (stats[e.type] ?? 0) + 1;
    if (e.isUnique) {
      stats['unique_' + e.type] = (stats['unique_' + e.type] ?? 0) + 1;
    }
  }
  return stats;
};

const newStats = () => ({
  products: [],
  sources: { read: 0, created: 0, reused: 0, apiKeyConflicts: 0 },
  contacts: { read: 0, invalidEmail: 0, duplicates: 0, existing: 0, created: 0, byStatus: {} },
  inscriptions: { read: 0, created: 0, synthesized: 0 },
  events: { created: 0, guaranteed: 0 },
  eventCaches: { created: 0 },
  blacklist: { read: 0, created: 0, updated: 0 },
  messages: { read: 0, created: 0 }
});

/**
 * Reprend les produits choisis d'une base media dans la base de l'instance.
 * @param {object} options
 * @param {import('sequelize').Sequelize} options.sequelize base cible (modèles initialisés, schéma à jour)
 * @param {string} [options.sourceUrl] URL PostgreSQL de la base media (ou `source`, un client pg déjà connecté)
 * @param {import('pg').Client} [options.source]
 * @param {string[]} [options.products] uid ou id des produits à reprendre (défaut : le seul produit de la base)
 * @param {number} [options.sinceDays] fenêtre des envois repris en événements (défaut 90 ; 0 : aucun envoi, seulement les
 *   événements porteurs de statut)
 * @param {number} [options.batchSize]
 * @param {boolean} [options.dryRun] tout exécuter dans une transaction annulée à la fin (rien n'est écrit)
 * @param {boolean} [options.skipBlacklist]
 * @param {boolean} [options.skipMessages]
 * @param {string} [options.timezone] fuseau des journées d'inscription (isFirstToday), défaut TZ ou Europe/Paris
 * @param {Date} [options.now]
 * @param {(progress: object) => void} [options.onProgress]
 */
const migrateFromMedia = async (options) => {
  const { sequelize, batchSize = DEFAULT_BATCH_SIZE, sinceDays = DEFAULT_SINCE_DAYS, dryRun = false, skipBlacklist = false, skipMessages = false, onProgress = () => {} } = options;
  const timezone = options.timezone || process.env.TZ || DEFAULT_TIMEZONE;
  const now = options.now ?? new Date();
  const { Contact, ContactInscription, ContactSource, ContactEvent, ContactEvents, BlacklistedContact, ContactMessage } = sequelize.models;
  const stats = newStats();
  stats.dryRun = dryRun;

  const ownSource = !options.source;
  const source = options.source ?? (await openSource(options.sourceUrl));
  const globalTransaction = dryRun ? await sequelize.transaction() : null;
  const transaction = async () => globalTransaction ?? sequelize.transaction();
  const finish = async (t) => {
    if (t !== globalTransaction) {
      await t.commit();
    }
  };

  try {
    const products = await resolveProducts(source, options.products);
    stats.products = products.map((p) => p.uid);
    const productIds = products.map((p) => p.id);
    const since = sinceDays > 0 ? moment(now).subtract(sinceDays, 'days').toDate() : null;
    log.info(`Reprise des produits ${stats.products.join(', ')} (envois depuis ${sinceDays} j, lots de ${batchSize}${dryRun ? ', simulation' : ''})`);

    // ---------- sources ----------
    const sourceIds = new Map(); // id media → id v2
    {
      const t = await transaction();
      const { rows } = await source.query('SELECT * FROM contact_source WHERE product_id = ANY($1::int[]) ORDER BY id', [productIds]);
      stats.sources.read = rows.length;
      const existingSources = await ContactSource.findAll({ transaction: t });
      const byName = new Map(existingSources.map((s) => [s.name, s]));
      const usedKeys = new Set(existingSources.map((s) => s.apiKey).filter(Boolean));
      for (const row of rows) {
        const name = (row.name || `media-source-${row.id}`).trim();
        let target = byName.get(name);
        if (target) {
          stats.sources.reused++;
        } else {
          let apiKey = row.api_key || null;
          if (apiKey && usedKeys.has(apiKey)) {
            log.warn(`Source ${name} : clé API déjà utilisée par une autre source, non reprise`);
            stats.sources.apiKeyConflicts++;
            apiKey = null;
          }
          target = await ContactSource.create(
            { name, utmSource: row.utm_source ?? null, apiEnabled: row.api_enabled ?? null, apiKey, apiFields: row.api_fields ?? null, apiSettings: row.api_settings ?? null, createdAt: toDate(row.created_at) ?? now, updatedAt: toDate(row.updated_at) ?? now },
            { transaction: t }
          );
          byName.set(name, target);
          if (apiKey) {
            usedKeys.add(apiKey);
          }
          stats.sources.created++;
        }
        sourceIds.set(row.id, target.id);
      }
      await finish(t);
    }

    // ---------- blacklist (globale à la base media) ----------
    if (!skipBlacklist) {
      let lastId = 0;
      for (;;) {
        const { rows } = await source.query('SELECT * FROM blacklisted_contact WHERE id > $1 ORDER BY id LIMIT $2', [lastId, batchSize]);
        if (rows.length === 0) {
          break;
        }
        lastId = rows[rows.length - 1].id;
        stats.blacklist.read += rows.length;
        const t = await transaction();
        const hashes = rows.flatMap((r) => [r.md5, r.sha1, r.sha256]).filter(Boolean);
        const existing = await BlacklistedContact.findAll({ where: { [Op.or]: [{ md5: { [Op.in]: hashes } }, { sha1: { [Op.in]: hashes } }, { sha256: { [Op.in]: hashes } }] }, transaction: t });
        const toCreate = [];
        for (const row of rows) {
          const found = existing.find((b) => (row.md5 && b.md5 === row.md5) || (row.sha1 && b.sha1 === row.sha1) || (row.sha256 && b.sha256 === row.sha256));
          const history = row.history && typeof row.history === 'object' && Array.isArray(row.history.blacklists) ? row.history : { blacklists: [{ origin: 'toolso-media', reason: 'blacklisted_contact', date: toDate(row.created_at) ?? now }] };
          if (found) {
            found.history = { ...(found.history ?? {}), blacklists: [...(found.history?.blacklists ?? []), ...history.blacklists] };
            found.changed('history', true);
            await found.save({ transaction: t });
            stats.blacklist.updated++;
          } else if (row.md5 || row.sha1 || row.sha256) {
            toCreate.push({ email: null, md5: row.md5 ?? null, sha1: row.sha1 ?? null, sha256: row.sha256 ?? null, stats: null, history, createdAt: toDate(row.created_at) ?? now, updatedAt: toDate(row.updated_at) ?? now });
          }
        }
        if (toCreate.length) {
          await BlacklistedContact.bulkCreate(toCreate, { transaction: t });
          stats.blacklist.created += toCreate.length;
        }
        await finish(t);
      }
    }

    // ---------- contacts, inscriptions, événements, messages ----------
    const migrateBatch = async (rows, product) => {
      const t = await transaction();
      // e-mails valides, uniques dans le lot et absents de la cible
      const candidates = [];
      const seen = new Set();
      for (const row of rows) {
        const email = normalizeEmail(row.email);
        if (!email) {
          stats.contacts.invalidEmail++;
          continue;
        }
        if (seen.has(email)) {
          stats.contacts.duplicates++;
          continue;
        }
        seen.add(email);
        candidates.push({ row, email });
      }
      if (candidates.length === 0) {
        await finish(t);
        return;
      }
      const existing = new Set((await Contact.findAll({ where: { email: { [Op.in]: candidates.map((c) => c.email) } }, attributes: ['email'], transaction: t })).map((c) => c.email));
      const selected = candidates.filter((c) => {
        if (existing.has(c.email)) {
          stats.contacts.existing++;
          return false;
        }
        return true;
      });
      if (selected.length === 0) {
        await finish(t);
        return;
      }
      const mediaIds = selected.map((c) => c.row.id);
      const groupBy = (list, key) => {
        const map = new Map();
        for (const item of list) {
          const k = item[key];
          if (!map.has(k)) {
            map.set(k, []);
          }
          map.get(k).push(item);
        }
        return map;
      };
      const inscriptionsBy = groupBy((await source.query('SELECT * FROM inscription WHERE contact_id = ANY($1::int[]) ORDER BY contact_id, inscripted_at, id', [mediaIds])).rows, 'contact_id');
      const emailsBy = since ? groupBy((await source.query('SELECT * FROM email WHERE contact_id = ANY($1::int[]) AND sent_at >= $2 ORDER BY contact_id, sent_at', [mediaIds, since])).rows, 'contact_id') : new Map();
      const historyBy = groupBy((await source.query('SELECT * FROM contact_history WHERE contact_id = ANY($1::int[]) AND type = ANY($2::text[]) ORDER BY contact_id, date', [mediaIds, Object.keys(HISTORY_EVENT_TYPES)])).rows, 'contact_id');
      const messagesBy = skipMessages ? new Map() : groupBy((await source.query('SELECT * FROM contact_message WHERE contact_id = ANY($1::int[]) ORDER BY contact_id, id', [mediaIds])).rows, 'contact_id');

      // 1. contacts
      const prepared = [];
      for (const { row, email } of selected) {
        const mediaStats = emailingStats(row.stats);
        const activated = hasActivity(mediaStats);
        let status = STATUS_MAPPING[row.email_status] ?? ContactStatus.new;
        if (status === ContactStatus.workable && !activated) {
          status = ContactStatus.new;
        }
        const mediaInscriptions = inscriptionsBy.get(row.id) ?? [];
        stats.inscriptions.read += mediaInscriptions.length;
        const inscriptions = mediaInscriptions
          .map((i) => ({ row: i, date: toDate(i.inscripted_at) ?? toDate(i.created_at) }))
          .filter((i) => i.date)
          .sort((a, b) => a.date - b.date);
        let synthesized = false;
        if (inscriptions.length === 0) {
          synthesized = true;
          inscriptions.push({ row: null, date: toDate(row.created_at) ?? now });
        }
        const lastInscription = inscriptions[inscriptions.length - 1];
        const { events, guaranteed, lastRequestDate } = buildEvents({ contact: row, status, emails: emailsBy.get(row.id) ?? [], history: historyBy.get(row.id) ?? [], lastInscriptionDate: lastInscription.date, esp: extractEsp(email) });
        stats.events.guaranteed += guaranteed;
        const customFields = { ...(row.fields && typeof row.fields === 'object' ? row.fields : {}) };
        delete customFields.email;
        if (row.country) {
          customFields.country = row.country;
        }
        customFields.media = { product: product.uid, id: row.id };
        const scores = row.scores && typeof row.scores === 'object' ? row.scores.emailing : null;
        const workable = status === ContactStatus.workable || status === ContactStatus.new;
        const contact = {
          email,
          gender: normalizeGender(row.gender),
          dob: normalizeDob(row.dob),
          customFields,
          segment: Math.floor(Math.random() * 100) + 1,
          esp: extractEsp(email),
          md5: md5(email),
          sha1: sha1(email),
          sha256: sha256(email),
          status,
          statusDetail: row.email_status === 'contact_bounce' ? { reason: 'Too much contact bounce.', origin: 'toolso-media' } : null,
          nextStatusUpdateDate: null,
          statusQueued: false,
          lastWorkableStatusDate: now,
          activated,
          blacklisted: status === ContactStatus.blacklisted,
          pixelTrackingConsent: typeof row.pixel_tracking_consent === 'boolean' ? row.pixel_tracking_consent : null,
          activityScore: workable ? (typeof scores?.activityScore === 'number' ? scores.activityScore : null) : 0,
          customScores: {},
          stats: mediaStats ?? countsFromEvents(events),
          lastRequestDate,
          createdAt: toDate(row.created_at) ?? now,
          updatedAt: toDate(row.updated_at) ?? now
        };
        for (const field of CONTACT_FIELDS) {
          contact[field] = truncate(row[field], 255);
        }
        prepared.push({ row, contact, inscriptions, synthesized, events, messages: messagesBy.get(row.id) ?? [] });
        stats.contacts.byStatus[status] = (stats.contacts.byStatus[status] ?? 0) + 1;
      }
      const created = await Contact.bulkCreate(
        prepared.map((p) => p.contact),
        { transaction: t, returning: true }
      );
      created.forEach((instance, i) => (prepared[i].contactId = instance.id));
      stats.contacts.created += created.length;

      // 2. inscriptions (isFirst / isFirstToday calculés dans le fuseau de l'instance)
      const inscriptionRows = [];
      for (const p of prepared) {
        let previousDay = null;
        p.inscriptions.forEach((i, index) => {
          const day = moment(i.date).tz(timezone).format('YYYY-MM-DD');
          const isLast = index === p.inscriptions.length - 1;
          const inscriptionStats = i.row ? emailingStats(i.row.stats) : null;
          inscriptionRows.push({
            contactId: p.contactId,
            sourceId: i.row && i.row.contact_source_id ? sourceIds.get(i.row.contact_source_id) ?? null : null,
            inscriptionDate: i.date,
            ip: i.row ? truncate(i.row.collect_ip, 255) : null,
            sourceName: i.row ? truncate(i.row.source_name, 255) : 'toolso-media',
            collectUrl: i.row ? truncate(i.row.collect_url, 1000) : null,
            fields: i.row && i.row.fields && typeof i.row.fields === 'object' ? i.row.fields : {},
            isFirst: i.row && typeof i.row.is_new === 'boolean' ? i.row.is_new : index === 0,
            isFirstToday: day !== previousDay,
            activated: hasActivity(inscriptionStats) || (isLast && p.contact.activated),
            stats: inscriptionStats,
            createdAt: i.row ? toDate(i.row.created_at) ?? i.date : i.date,
            updatedAt: i.row ? toDate(i.row.updated_at) ?? i.date : i.date
          });
          previousDay = day;
          i.index = inscriptionRows.length - 1;
        });
      }
      const createdInscriptions = await ContactInscription.bulkCreate(inscriptionRows, { transaction: t, returning: true });
      stats.inscriptions.created += createdInscriptions.length;
      const lastInscriptionValues = [];
      for (const p of prepared) {
        for (const i of p.inscriptions) {
          i.id = createdInscriptions[i.index].id;
          i.sourceId = inscriptionRows[i.index].sourceId;
        }
        if (p.synthesized) {
          stats.inscriptions.synthesized++;
        }
        const last = p.inscriptions[p.inscriptions.length - 1];
        lastInscriptionValues.push([p.contactId, last.id, last.sourceId]);
      }
      await sequelize.query(
        `UPDATE "Contact" AS c SET "lastInscriptionId" = v.inscription_id, "lastSourceId" = v.source_id
           FROM (VALUES ${lastInscriptionValues.map((_, i) => `($${3 * i + 1}::int, $${3 * i + 2}::int, $${3 * i + 3}::int)`).join(', ')}) AS v(id, inscription_id, source_id)
          WHERE c.id = v.id`,
        { bind: lastInscriptionValues.flat(), type: QueryTypes.UPDATE, transaction: t }
      );

      // 3. événements puis cache des événements (stats reprises : le cache évite de les recompter)
      const eventRows = [];
      for (const p of prepared) {
        for (const e of p.events) {
          const inscription = [...p.inscriptions].reverse().find((i) => i.date <= e.date) ?? null;
          eventRows.push({ ...e, contactId: p.contactId, inscriptionId: inscription ? inscription.id : null, sourceId: inscription ? inscription.sourceId : null, createdAt: e.date, updatedAt: e.date });
          e.index = eventRows.length - 1;
        }
      }
      if (eventRows.length) {
        const createdEvents = await ContactEvent.bulkCreate(eventRows, { transaction: t, returning: true });
        stats.events.created += createdEvents.length;
        const cacheRows = [];
        for (const p of prepared) {
          if (p.events.length === 0) {
            continue;
          }
          const events = p.events.map((e) => createdEvents[e.index].get({ plain: true })).sort((a, b) => b.date - a.date);
          cacheRows.push({ contactId: p.contactId, events, lastImportedId: Math.max(...events.map((e) => e.id)), lastImportedDate: events[0].date });
        }
        await ContactEvents.bulkCreate(cacheRows, { transaction: t });
        stats.eventCaches.created += cacheRows.length;
      }

      // 4. messages reçus
      if (!skipMessages) {
        const messageRows = [];
        for (const p of prepared) {
          for (const m of p.messages) {
            stats.messages.read++;
            const text = m.text || m.body || m.html || '';
            messageRows.push({
              contactId: p.contactId,
              date: toDate(m.received_at) ?? toDate(m.created_at) ?? now,
              from: truncate(m.from, 255),
              to: truncate(m.to, 255),
              title: truncate(m.subject, 255),
              message: text,
              extract: truncate(text.replace(/\s+/g, ' ').trim(), 255),
              status: m.status === 'pending' && !m.sent ? 'pending' : 'done',
              sendFromToolso: false,
              author: null,
              createdAt: toDate(m.created_at) ?? now,
              updatedAt: toDate(m.updated_at) ?? now
            });
          }
        }
        if (messageRows.length) {
          await ContactMessage.bulkCreate(messageRows, { transaction: t });
          stats.messages.created += messageRows.length;
        }
      }
      await finish(t);
    };

    for (const product of products) {
      let lastId = 0;
      for (;;) {
        const { rows } = await source.query('SELECT * FROM contact WHERE product_id = $1 AND id > $2 ORDER BY id LIMIT $3', [product.id, lastId, batchSize]);
        if (rows.length === 0) {
          break;
        }
        lastId = rows[rows.length - 1].id;
        stats.contacts.read += rows.length;
        await migrateBatch(rows, product);
        onProgress({ product: product.uid, lastId, ...stats.contacts });
      }
    }

    if (globalTransaction) {
      await globalTransaction.rollback();
      log.info('Simulation : transaction annulée, rien n\'a été écrit');
    }
    return stats;
  } catch (err) {
    if (globalTransaction) {
      await globalTransaction.rollback().catch(() => {});
    }
    throw err;
  } finally {
    if (ownSource) {
      await source.end().catch(() => {});
    }
  }
};

module.exports = {
  migrateFromMedia,
  openSource,
  listProducts,
  resolveProducts,
  inventory,
  buildEvents,
  normalizeEmail,
  normalizeGender,
  normalizeDob,
  STATUS_MAPPING,
  HISTORY_EVENT_TYPES,
  DEFAULT_SINCE_DAYS,
  DEFAULT_BATCH_SIZE
};
