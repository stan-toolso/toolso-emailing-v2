const moment = require('moment-timezone');
const { Op, QueryTypes } = require('sequelize');
const { extractEsp } = require('../services/EspService');
const ContactStatus = require('../storage/models/ContactStatus');
const EventType = require('../storage/models/EventType');
const media = require('./mediaDatabase');
const log = require('../util/log').getLogger('MediaStatusSync');

/**
 * Synchronisation des statuts toolso-media → instance v2 pendant la transition (après la reprise de mediaDatabase.js).
 *
 * Après la bascule d'un produit, les liens de désabonnement des mails déjà envoyés par media et les retours de l'ESP
 * (plaintes, hard bounces) arrivent encore dans media. Ce module relit, pour les produits de l'instance, ce qui a changé
 * dans media depuis le dernier passage et le rejoue dans la base v2 :
 *
 *   contact_history (emailing_unsub / complaint / hard_bounce / contact_bounce)  → ContactEvent du même type
 *   email (drapeaux unsubcribed / complainted / hard_bounced, envois récents)      → ContactEvent (filet de sécurité)
 *   contact.email_status (unsub, complaint, hard_bounce) modifié                  → ContactEvent « garanti », comme la reprise
 *   contact.email_status = blacklisted                                             → Contact.status = blacklisted
 *   blacklisted_contact (globale à la base media) modifiée                         → BlacklistedContact
 *   inscription de contacts déjà présents dans la v2                               → ContactInscription (réinscription)
 *   nouveaux contacts media (id > curseur)                                         → reprise de mediaDatabase.migrateFromMedia
 *
 * puis recalcule le statut des contacts touchés (ContactStatusService, comme le worker update_contact_status).
 *
 * Contacts rapprochés par e-mail (normalisé). Idempotent : chaque événement rejoué porte `details.media.key`
 * (h:<id contact_history>, e:<id email>:<type>, s:<id contact>:<statut>) ; un événement déjà présent avec cette clé, ou du
 * même type à moins de 10 minutes (événements créés par la reprise), n'est pas recréé. Un désabonnement antérieur à la
 * dernière inscription v2 est ignoré (il ne compte pas dans le statut v2).
 *
 * Date des événements : la date media, sauf si elle est antérieure au dernier événement déjà intégré au cache
 * `ContactEvents` du contact (le recalcul de statut ne relit que les événements postérieurs) : l'événement est alors daté
 * de la synchronisation, la date media étant conservée dans `details.media.date` et `requestDate`.
 *
 * Curseur persistant : ligne `Settings` « mediaStatusSync » (JSON) : par produit, dernier id de contact_history et de
 * contact lus, et date de début du dernier passage (les lectures par date reprennent `overlapMinutes` avant). Premier
 * passage sans curseur : tout l'historique (rattrapage complet, sans doublon grâce à la déduplication).
 *
 * Base media lue en SELECT seulement (connexion en lecture seule, voir mediaDatabase.openSource).
 */

const CURSOR_SETTING = 'mediaStatusSync';
const DEFAULT_OVERLAP_MINUTES = 60;
const DEFAULT_EMAIL_FLAGS_DAYS = 60;
const DEDUP_WINDOW_MS = 10 * 60 * 1000;
const STATUS_TYPES = [EventType.unsub, EventType.complaint, EventType.hard_bounce, EventType.contact_bounce];
/** drapeaux de `email` porteurs de statut → EventType */
const EMAIL_STATUS_FLAGS = Object.freeze([
  ['unsubcribed', EventType.unsub],
  ['complainted', EventType.complaint],
  ['hard_bounced', EventType.hard_bounce]
]);
/** email_status media qui portent un événement de statut v2 (contact_bounce → hard_bounce chez media : voir STATUS_MAPPING) */
const SWEPT_STATUSES = ['unsub', 'complaint', 'hard_bounce', 'blacklisted'];

const newStats = () => ({
  products: [],
  dryRun: false,
  since: null,
  history: { read: 0, created: 0, existing: 0, stale: 0, noContact: 0 },
  emailFlags: { read: 0, created: 0, existing: 0, stale: 0, noContact: 0 },
  statuses: { read: 0, created: 0, existing: 0, blacklisted: 0, noContact: 0 },
  blacklist: { read: 0, created: 0, existing: 0 },
  inscriptions: { read: 0, created: 0, existing: 0, noContact: 0 },
  newContacts: null,
  touched: 0,
  recalculated: 0,
  statusChanges: {}
});

const readCursor = async (sequelize, transaction) => {
  const row = await sequelize.models.Settings.findOne({ where: { name: CURSOR_SETTING }, transaction });
  if (!row || !row.value) {
    return { products: {} };
  }
  try {
    const value = JSON.parse(row.value);
    return value && typeof value === 'object' ? { products: {}, ...value } : { products: {} };
  } catch (err) {
    log.warn(`Curseur ${CURSOR_SETTING} illisible, rattrapage complet`);
    return { products: {} };
  }
};

const writeCursor = async (sequelize, cursor) => {
  const { Settings } = sequelize.models;
  const value = JSON.stringify(cursor);
  const row = await Settings.findOne({ where: { name: CURSOR_SETTING } });
  if (row) {
    row.value = value;
    await row.save();
  } else {
    await Settings.create({ name: CURSOR_SETTING, value });
  }
};

/** Dernier passage connu (curseur) : utile aux scripts et à la supervision. */
const getCursor = async (sequelize) => readCursor(sequelize);

/** Paramètres d'activation lus dans l'environnement de l'instance (job planifié). */
const configFromEnv = (env = process.env) => ({
  enabled: env.MEDIA_STATUS_SYNC === '1' || env.MEDIA_STATUS_SYNC === 'true',
  sourceUrl: env.MEDIA_DATABASE_URL || null,
  products: (env.MEDIA_PRODUCTS || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean),
  newContacts: env.MEDIA_STATUS_SYNC_NEW_CONTACTS !== '0' && env.MEDIA_STATUS_SYNC_NEW_CONTACTS !== 'false'
});

/**
 * Synchronise les statuts des produits media choisis vers la base de l'instance.
 * @param {object} options
 * @param {import('sequelize').Sequelize} options.sequelize base cible
 * @param {string} [options.sourceUrl] URL de la base media (ou `source`, client pg connecté)
 * @param {import('pg').Client} [options.source]
 * @param {string[]} options.products uid ou id des produits media de l'instance
 * @param {boolean} [options.dryRun] tout dans une transaction annulée, curseur inchangé, pas de recalcul
 * @param {boolean} [options.newContacts] rattraper les nouveaux contacts media (défaut true)
 * @param {boolean} [options.recalculate] recalculer tout de suite le statut des contacts touchés (défaut true ; sinon le job
 *   scan_contact_to_update_status s'en charge : nextStatusUpdateDate remis à vide)
 * @param {boolean} [options.full] ignorer le curseur (rattrapage complet)
 * @param {number} [options.overlapMinutes] recouvrement des lectures par date (défaut 60)
 * @param {number} [options.emailFlagsDays] fenêtre des envois media relus pour leurs drapeaux (défaut 60 ; 0 : aucun)
 * @param {number} [options.batchSize]
 * @param {string} [options.timezone]
 * @param {Date} [options.now]
 */
const syncStatusesFromMedia = async (options) => {
  const { sequelize, dryRun = false, newContacts = true, recalculate = true, full = false } = options;
  const batchSize = options.batchSize ?? media.DEFAULT_BATCH_SIZE;
  const overlapMinutes = options.overlapMinutes ?? DEFAULT_OVERLAP_MINUTES;
  const emailFlagsDays = options.emailFlagsDays ?? DEFAULT_EMAIL_FLAGS_DAYS;
  const timezone = options.timezone || process.env.TZ || 'Europe/Paris';
  const now = options.now ?? new Date();
  const runStart = new Date();
  const { Contact, ContactInscription, ContactSource, ContactEvent, BlacklistedContact } = sequelize.models;
  const stats = newStats();
  stats.dryRun = dryRun;

  const ownSource = !options.source;
  const source = options.source ?? (await media.openSource(options.sourceUrl));
  const globalTransaction = dryRun ? await sequelize.transaction() : null;
  const withTransaction = async (fn) => {
    if (globalTransaction) {
      return fn(globalTransaction);
    }
    return sequelize.transaction(fn);
  };
  const touched = new Set();

  try {
    const products = await media.resolveProducts(source, options.products);
    stats.products = products.map((p) => p.uid);
    const productIds = products.map((p) => p.id);
    const cursor = full ? { products: {} } : await readCursor(sequelize, globalTransaction);
    const productCursor = (p) => cursor.products[p.uid] ?? {};
    const sinceOf = (p) => {
      const last = productCursor(p).lastRunAt;
      return last ? new Date(new Date(last).getTime() - overlapMinutes * 60000) : null;
    };
    stats.since = Object.fromEntries(products.map((p) => [p.uid, sinceOf(p)]));
    const nextCursor = { products: { ...cursor.products } };
    log.info(`Synchronisation des statuts media des produits ${stats.products.join(', ')}${dryRun ? ' (simulation)' : ''}`);

    // ---------- 1. nouveaux contacts (reprise standard à partir du dernier id lu) ----------
    if (newContacts) {
      const fromContactIds = {};
      for (const p of products) {
        fromContactIds[p.uid] = productCursor(p).contactId ?? 0;
      }
      const migrated = await media.migrateFromMedia({ sequelize, source, products: stats.products, fromContactIds, dryRun, batchSize, timezone, skipBlacklist: true, now });
      stats.newContacts = { ...migrated.contacts, inscriptions: migrated.inscriptions.created, events: migrated.events.created };
      for (const p of products) {
        nextCursor.products[p.uid] = { ...(nextCursor.products[p.uid] ?? {}), contactId: migrated.lastContactIds[p.uid] ?? fromContactIds[p.uid] };
      }
    }

    // ---------- contexte v2 d'un lot de contacts media ----------
    const mediaEmails = new Map(); // id contact media → e-mail normalisé
    const resolveMediaEmails = async (ids) => {
      const missing = [...new Set(ids)].filter((id) => id != null && !mediaEmails.has(id));
      if (missing.length) {
        const { rows } = await source.query('SELECT id, email FROM contact WHERE id = ANY($1::int[])', [missing]);
        for (const id of missing) {
          mediaEmails.set(id, null);
        }
        for (const row of rows) {
          mediaEmails.set(row.id, media.normalizeEmail(row.email));
        }
      }
    };
    /** contacts v2 (par e-mail) avec inscriptions, événements de statut et date du cache d'événements */
    const loadTargets = async (emails, t) => {
      emails = [...new Set(emails.filter(Boolean))];
      const targets = new Map();
      if (emails.length === 0) {
        return targets;
      }
      const contacts = await Contact.findAll({ where: { email: { [Op.in]: emails } }, attributes: ['id', 'email', 'status', 'lastInscriptionId'], transaction: t });
      if (contacts.length === 0) {
        return targets;
      }
      const ids = contacts.map((c) => c.id);
      const byId = new Map();
      for (const c of contacts) {
        const target = { contact: c, inscriptions: [], events: [], lastImportedDate: null };
        targets.set(c.email, target);
        byId.set(c.id, target);
      }
      for (const i of await ContactInscription.findAll({ where: { contactId: { [Op.in]: ids } }, attributes: ['id', 'contactId', 'inscriptionDate', 'sourceId'], order: [['inscriptionDate', 'ASC']], transaction: t })) {
        byId.get(i.contactId).inscriptions.push(i);
      }
      for (const e of await ContactEvent.findAll({ where: { contactId: { [Op.in]: ids }, type: { [Op.in]: STATUS_TYPES } }, attributes: ['id', 'contactId', 'type', 'date', 'requestDate', 'details'], transaction: t })) {
        byId.get(e.contactId).events.push({ type: e.type, date: e.date, mediaDate: media.toDate(e.details?.media?.date) ?? e.requestDate ?? e.date, key: e.details?.media?.key ?? null });
      }
      const caches = await sequelize.query('SELECT "contactId", "lastImportedDate" FROM "ContactEvents" WHERE "contactId" IN (:ids)', { replacements: { ids }, type: QueryTypes.SELECT, transaction: t });
      for (const c of caches) {
        byId.get(c.contactId).lastImportedDate = media.toDate(c.lastImportedDate);
      }
      return targets;
    };
    const lastInscriptionDate = (target) => (target.inscriptions.length ? target.inscriptions[target.inscriptions.length - 1].inscriptionDate : null);

    /**
     * Crée les événements manquants. candidat : { mediaContactId, type, date, key, details, kind, product, guarantee }
     * (guarantee : événement de statut, créé seulement si aucun événement de ce type n'existe — après la dernière
     * inscription pour un désabonnement).
     */
    const applyCandidates = async (candidates, counter) => {
      if (candidates.length === 0) {
        return;
      }
      await resolveMediaEmails(candidates.map((c) => c.mediaContactId));
      await withTransaction(async (t) => {
        const targets = await loadTargets(
          candidates.map((c) => mediaEmails.get(c.mediaContactId)),
          t
        );
        const rows = [];
        for (const c of candidates) {
          const email = mediaEmails.get(c.mediaContactId);
          const target = email ? targets.get(email) : null;
          if (!target) {
            counter.noContact++;
            continue;
          }
          const lastInscription = lastInscriptionDate(target);
          let date = media.toDate(c.date);
          if (c.guarantee) {
            const minDate = c.type === EventType.unsub ? lastInscription : null;
            if (target.events.some((e) => e.type === c.type && (!minDate || e.mediaDate >= minDate || e.date >= minDate))) {
              counter.existing++;
              continue;
            }
            date = date ?? now;
            if (minDate && date <= minDate) {
              date = new Date(minDate.getTime() + 1000);
            }
          } else {
            if (!date) {
              continue;
            }
            if (target.events.some((e) => (c.key && e.key === c.key) || (e.type === c.type && (Math.abs(e.mediaDate - date) <= DEDUP_WINDOW_MS || Math.abs(e.date - date) <= DEDUP_WINDOW_MS)))) {
              counter.existing++;
              continue;
            }
            if (c.type === EventType.unsub && lastInscription && date < lastInscription) {
              counter.stale++;
              continue;
            }
          }
          const mediaDate = date;
          const eventDate = target.lastImportedDate && date <= target.lastImportedDate ? now : date;
          const inscription = [...target.inscriptions].reverse().find((i) => i.inscriptionDate <= eventDate) ?? target.inscriptions[target.inscriptions.length - 1] ?? null;
          rows.push({
            contactId: target.contact.id,
            type: c.type,
            date: eventDate,
            requestDate: mediaDate,
            messageId: c.messageId ?? null,
            esp: extractEsp(target.contact.email),
            isUnique: null,
            details: { ...(c.details ?? {}), media: { product: c.product, kind: c.kind, key: c.key, date: mediaDate.toISOString() } },
            inscriptionId: inscription ? inscription.id : null,
            sourceId: inscription ? inscription.sourceId : null,
            createdAt: now,
            updatedAt: now
          });
          target.events.push({ type: c.type, date: eventDate, mediaDate, key: c.key });
          touched.add(target.contact.id);
        }
        if (rows.length) {
          await ContactEvent.bulkCreate(rows, { transaction: t });
          counter.created += rows.length;
        }
      });
    };

    for (const product of products) {
      const pc = productCursor(product);
      const since = sinceOf(product);

      // ---------- 2. réinscriptions de contacts déjà présents dans la v2 ----------
      {
        const sourceNames = new Map(); // id contact_source media → nom
        for (const row of (await source.query('SELECT id, name FROM contact_source WHERE product_id = $1', [product.id])).rows) {
          sourceNames.set(row.id, (row.name || `media-source-${row.id}`).trim());
        }
        const v2Sources = new Map((await ContactSource.findAll({ attributes: ['id', 'name'], transaction: globalTransaction })).map((s) => [s.name, s.id]));
        let lastId = 0;
        for (;;) {
          const { rows } = since
            ? await source.query('SELECT * FROM inscription WHERE product_id = $1 AND inscripted_at >= $2 AND id > $3 ORDER BY id LIMIT $4', [product.id, since, lastId, batchSize])
            : await source.query('SELECT * FROM inscription WHERE product_id = $1 AND id > $2 ORDER BY id LIMIT $3', [product.id, lastId, batchSize]);
          if (rows.length === 0) {
            break;
          }
          lastId = rows[rows.length - 1].id;
          stats.inscriptions.read += rows.length;
          await resolveMediaEmails(rows.map((r) => r.contact_id));
          await withTransaction(async (t) => {
            const targets = await loadTargets(
              rows.map((r) => mediaEmails.get(r.contact_id)),
              t
            );
            for (const row of rows) {
              const email = mediaEmails.get(row.contact_id);
              const target = email ? targets.get(email) : null;
              const date = media.toDate(row.inscripted_at) ?? media.toDate(row.created_at);
              if (!target || !date) {
                stats.inscriptions.noContact++;
                continue;
              }
              if (target.inscriptions.some((i) => Math.abs(i.inscriptionDate - date) < 1000)) {
                stats.inscriptions.existing++;
                continue;
              }
              const day = moment(date).tz(timezone).format('YYYY-MM-DD');
              const sourceId = row.contact_source_id ? v2Sources.get(sourceNames.get(row.contact_source_id)) ?? null : null;
              const created = await ContactInscription.create(
                {
                  contactId: target.contact.id,
                  sourceId,
                  inscriptionDate: date,
                  ip: row.collect_ip ? String(row.collect_ip).slice(0, 255) : null,
                  sourceName: row.source_name ? String(row.source_name).slice(0, 255) : 'toolso-media',
                  collectUrl: row.collect_url ? String(row.collect_url).slice(0, 1000) : null,
                  fields: row.fields && typeof row.fields === 'object' ? row.fields : {},
                  isFirst: false,
                  isFirstToday: !target.inscriptions.some((i) => moment(i.inscriptionDate).tz(timezone).format('YYYY-MM-DD') === day),
                  activated: false,
                  stats: null,
                  createdAt: now,
                  updatedAt: now
                },
                { transaction: t }
              );
              const previousLast = lastInscriptionDate(target);
              target.inscriptions.push(created);
              target.inscriptions.sort((a, b) => a.inscriptionDate - b.inscriptionDate);
              if (!previousLast || date > previousLast) {
                await Contact.update({ lastInscriptionId: created.id, lastSourceId: sourceId }, { where: { id: target.contact.id }, transaction: t });
              }
              stats.inscriptions.created++;
              touched.add(target.contact.id);
            }
          });
        }
      }

      // ---------- 3. historique de statut (désabonnements, plaintes, bounces) ----------
      {
        const types = Object.keys(media.HISTORY_EVENT_TYPES);
        let maxId = pc.historyId ?? 0;
        const seen = new Set();
        const consume = async (rows) => {
          const candidates = [];
          for (const row of rows) {
            if (seen.has(row.id)) {
              continue;
            }
            seen.add(row.id);
            stats.history.read++;
            maxId = Math.max(maxId, row.id);
            candidates.push({
              mediaContactId: row.contact_id,
              type: media.HISTORY_EVENT_TYPES[row.type],
              date: row.date ?? row.created_at,
              key: `h:${row.id}`,
              kind: 'history',
              product: product.uid,
              details: row.details && typeof row.details === 'object' && !Array.isArray(row.details) ? row.details : null
            });
          }
          await applyCandidates(candidates, stats.history);
        };
        // a) lignes ajoutées depuis le dernier id lu
        let lastId = pc.historyId ?? 0;
        for (;;) {
          const { rows } = await source.query('SELECT * FROM contact_history WHERE product_id = $1 AND type = ANY($2::text[]) AND id > $3 ORDER BY id LIMIT $4', [product.id, types, lastId, batchSize]);
          if (rows.length === 0) {
            break;
          }
          lastId = rows[rows.length - 1].id;
          await consume(rows);
        }
        // b) recouvrement par date (transactions validées dans le désordre des id)
        if (since) {
          let lastRecent = 0;
          for (;;) {
            const { rows } = await source.query('SELECT * FROM contact_history WHERE date >= $1 AND product_id = $2 AND type = ANY($3::text[]) AND id > $4 ORDER BY id LIMIT $5', [since, product.id, types, lastRecent, batchSize]);
            if (rows.length === 0) {
              break;
            }
            lastRecent = rows[rows.length - 1].id;
            await consume(rows);
          }
        }
        nextCursor.products[product.uid] = { ...(nextCursor.products[product.uid] ?? {}), historyId: maxId };
      }

      // ---------- 4. drapeaux des envois récents (filet de sécurité : media écrit aussi l'historique) ----------
      if (emailFlagsDays > 0) {
        const sentSince = moment(now).subtract(emailFlagsDays, 'days').toDate();
        let lastId = 0;
        for (;;) {
          const params = [product.id, sentSince, lastId, batchSize];
          const { rows } = await source.query(
            `SELECT id, contact_id, message_id, sent_at, updated_at, unsubcribed, complainted, hard_bounced FROM email
              WHERE product_id = $1 AND sent_at >= $2 AND id > $3 AND (unsubcribed OR complainted OR hard_bounced)
              ${since ? 'AND updated_at >= $5' : ''} ORDER BY id LIMIT $4`,
            since ? [...params, since] : params
          );
          if (rows.length === 0) {
            break;
          }
          lastId = rows[rows.length - 1].id;
          const candidates = [];
          for (const row of rows) {
            stats.emailFlags.read++;
            for (const [flag, type] of EMAIL_STATUS_FLAGS) {
              if (row[flag]) {
                candidates.push({ mediaContactId: row.contact_id, type, date: row.updated_at ?? row.sent_at, key: `e:${row.id}:${type}`, kind: 'email', product: product.uid, messageId: row.message_id });
              }
            }
          }
          await applyCandidates(candidates, stats.emailFlags);
        }
      }

      // ---------- 5. statut media des contacts modifiés (événement garanti, blacklist) ----------
      {
        let lastId = 0;
        for (;;) {
          const params = [product.id, SWEPT_STATUSES, lastId, batchSize];
          const { rows } = await source.query(
            `SELECT id, email, email_status, last_status_update, updated_at FROM contact
              WHERE product_id = $1 AND email_status = ANY($2::text[]) AND id > $3
              ${since ? 'AND (updated_at >= $5 OR last_status_update >= $5)' : ''} ORDER BY id LIMIT $4`,
            since ? [...params, since] : params
          );
          if (rows.length === 0) {
            break;
          }
          lastId = rows[rows.length - 1].id;
          stats.statuses.read += rows.length;
          for (const row of rows) {
            mediaEmails.set(row.id, media.normalizeEmail(row.email));
          }
          const candidates = [];
          const blacklisted = [];
          for (const row of rows) {
            const type = media.STATUS_EVENT_OF[media.STATUS_MAPPING[row.email_status]];
            if (type) {
              candidates.push({ mediaContactId: row.id, type, date: row.last_status_update ?? row.updated_at, key: `s:${row.id}:${row.email_status}`, kind: 'status', product: product.uid, guarantee: true, details: { origin: 'toolso-media', reason: `email_status=${row.email_status}` } });
            } else if (row.email_status === 'blacklisted') {
              blacklisted.push(row);
            }
          }
          await applyCandidates(candidates, stats.statuses);
          if (blacklisted.length) {
            await withTransaction(async (t) => {
              const targets = await loadTargets(
                blacklisted.map((r) => mediaEmails.get(r.id)),
                t
              );
              for (const row of blacklisted) {
                const target = targets.get(mediaEmails.get(row.id));
                if (!target) {
                  stats.statuses.noContact++;
                } else if (target.contact.status === ContactStatus.blacklisted) {
                  stats.statuses.existing++;
                } else {
                  await Contact.update({ status: ContactStatus.blacklisted, blacklisted: true, statusDetail: { origin: 'toolso-media', reason: 'email_status=blacklisted' } }, { where: { id: target.contact.id }, transaction: t });
                  stats.statuses.blacklisted++;
                  touched.add(target.contact.id);
                }
              }
            });
          }
        }
      }
      nextCursor.products[product.uid] = { ...(nextCursor.products[product.uid] ?? {}), lastRunAt: runStart.toISOString() };
    }

    // ---------- 6. blacklist globale de la base media ----------
    {
      const since = cursor.blacklistRunAt ? new Date(new Date(cursor.blacklistRunAt).getTime() - overlapMinutes * 60000) : null;
      let lastId = 0;
      for (;;) {
        const { rows } = since
          ? await source.query('SELECT * FROM blacklisted_contact WHERE (updated_at >= $1 OR created_at >= $1) AND id > $2 ORDER BY id LIMIT $3', [since, lastId, batchSize])
          : await source.query('SELECT * FROM blacklisted_contact WHERE id > $1 ORDER BY id LIMIT $2', [lastId, batchSize]);
        if (rows.length === 0) {
          break;
        }
        lastId = rows[rows.length - 1].id;
        stats.blacklist.read += rows.length;
        await withTransaction(async (t) => {
          const hashes = rows.flatMap((r) => [r.md5, r.sha1, r.sha256]).filter(Boolean);
          if (hashes.length === 0) {
            return;
          }
          const existing = await BlacklistedContact.findAll({ where: { [Op.or]: [{ md5: { [Op.in]: hashes } }, { sha1: { [Op.in]: hashes } }, { sha256: { [Op.in]: hashes } }] }, attributes: ['id', 'md5', 'sha1', 'sha256'], transaction: t });
          const toCreate = [];
          for (const row of rows) {
            if (!(row.md5 || row.sha1 || row.sha256)) {
              continue;
            }
            if (existing.some((b) => (row.md5 && b.md5 === row.md5) || (row.sha1 && b.sha1 === row.sha1) || (row.sha256 && b.sha256 === row.sha256))) {
              stats.blacklist.existing++;
              continue;
            }
            const history = row.history && typeof row.history === 'object' && Array.isArray(row.history.blacklists) ? row.history : { blacklists: [{ origin: 'toolso-media', reason: 'blacklisted_contact', date: media.toDate(row.created_at) ?? now }] };
            toCreate.push({ email: null, md5: row.md5 ?? null, sha1: row.sha1 ?? null, sha256: row.sha256 ?? null, stats: null, history, createdAt: media.toDate(row.created_at) ?? now, updatedAt: now });
          }
          if (toCreate.length) {
            await BlacklistedContact.bulkCreate(toCreate, { transaction: t });
            stats.blacklist.created += toCreate.length;
            const created = toCreate.flatMap((b) => [b.md5, b.sha1, b.sha256]).filter(Boolean);
            const hit = await Contact.findAll({ where: { [Op.or]: [{ md5: { [Op.in]: created } }, { sha1: { [Op.in]: created } }, { sha256: { [Op.in]: created } }] }, attributes: ['id'], transaction: t });
            hit.forEach((c) => touched.add(c.id));
          }
        });
      }
      nextCursor.blacklistRunAt = runStart.toISOString();
    }

    // ---------- 7. recalcul du statut des contacts touchés ----------
    stats.touched = touched.size;
    if (globalTransaction) {
      await globalTransaction.rollback();
      log.info(`Simulation : ${touched.size} contacts auraient été recalculés ; transaction annulée, curseur inchangé`);
      return stats;
    }
    const ids = [...touched];
    for (let i = 0; i < ids.length; i += 500) {
      await Contact.update({ nextStatusUpdateDate: null, statusQueued: false }, { where: { id: { [Op.in]: ids.slice(i, i + 500) } } });
    }
    if (recalculate && ids.length) {
      const ContactStatusService = require('../services/ContactStatusService');
      const service = new ContactStatusService();
      for (const id of ids) {
        const before = await Contact.findByPk(id, { attributes: ['id', 'status'] });
        if (!before) {
          continue;
        }
        try {
          const after = await service.updateContactStatusWithId(id);
          const change = `${before.status}→${after ? after.status : 'removed'}`;
          stats.statusChanges[change] = (stats.statusChanges[change] ?? 0) + 1;
          stats.recalculated++;
        } catch (err) {
          log.error(`Recalcul du statut du contact ${id} échoué (le job scan_contact_to_update_status le reprendra)`, err);
        }
      }
    }
    nextCursor.lastRunAt = runStart.toISOString();
    nextCursor.lastStats = { touched: stats.touched, history: stats.history.created, emailFlags: stats.emailFlags.created, statuses: stats.statuses.created + stats.statuses.blacklisted, inscriptions: stats.inscriptions.created, newContacts: stats.newContacts ? stats.newContacts.created : null, blacklist: stats.blacklist.created };
    await writeCursor(sequelize, nextCursor);
    log.info(`Synchronisation terminée : ${touched.size} contacts touchés, ${stats.recalculated} recalculés`);
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

module.exports = { syncStatusesFromMedia, configFromEnv, getCursor, CURSOR_SETTING, DEFAULT_OVERLAP_MINUTES, DEFAULT_EMAIL_FLAGS_DAYS };
