const { QueryTypes } = require('sequelize');
const EventType = require('../storage/models/EventType');
const ContactStatus = require('../storage/models/ContactStatus');
const media = require('./mediaDatabase');
const log = require('../util/log').getLogger('MediaReverseSync');

/**
 * Synchronisation inverse instance v2 → toolso-media, pour le retour arrière d'un produit basculé (docs/06 § 8).
 *
 * Pendant que le produit était servi par la v2, les désabonnements, plaintes et bounces sont arrivés dans la v2 seulement.
 * Avant de réactiver les créneaux media, ce module les reporte dans la base media, comme media les aurait enregistrés lui-même
 * (backend/services/events/manageEmailingEvent.js du dépôt media) :
 *
 *   ContactEvent unsub (date ≥ bascule)           → contact.email_status = unsub        + contact_history emailing_unsub
 *   ContactEvent complaint                         → contact.email_status = complaint    + contact_history emailing_complaint
 *   ContactEvent hard_bounce / contact_bounce      → contact.email_status = hard_bounce  + contact_history emailing_<type>
 *   et, pour chaque contact modifié, suppression de ses envois media programmés non partis (email.done = false).
 *
 * Règles :
 *   - seuls les événements nés dans la v2 sont lus : date ≥ `since` (date de bascule) et ni rejoués depuis media par la
 *     synchronisation media → v2 (`details.media`), ni repris (`details.origin = 'toolso-media'`) ;
 *   - un désabonnement antérieur à la dernière inscription v2 du contact (réinscription) est ignoré, comme dans le statut v2 : le contact est à
 *     réinscrire dans media (liste `inscriptions`), pas à désabonner ;
 *   - statut media jamais affaibli : rang active/new/archived < unsub < hard_bounce/contact_bounce < complaint < blacklisted ;
 *     un contact déjà au moins aussi bloqué est laissé tel quel (le script est relançable sans doublon) ;
 *   - rapprochement par e-mail normalisé, dans les produits media donnés (tous les contacts de même e-mail de ces produits).
 *
 * Contacts inscrits (ou réinscrits) dans la v2 depuis la bascule et envoyables : ils manquent à media (ou y sont bloqués).
 * Ils sont comptés et listés (`listInscriptions`) pour être réimportés par l'API d'inscription media ; ce module ne crée
 * aucun contact dans media.
 *
 * Simulation par défaut (`apply: false`) : uniquement des SELECT dans media. `apply: true` écrit dans la base media de
 * production : connexion avec un compte limité (UPDATE contact, INSERT contact_history, DELETE email), une transaction par lot.
 */

const STATUS_EVENT_TYPES = [EventType.unsub, EventType.complaint, EventType.hard_bounce, EventType.contact_bounce];
/** type d'événement v2 → email_status media (media met hard_bounce pour un contact bounce) */
const MEDIA_STATUS_OF = Object.freeze({
  [EventType.unsub]: 'unsub',
  [EventType.complaint]: 'complaint',
  [EventType.hard_bounce]: 'hard_bounce',
  [EventType.contact_bounce]: 'hard_bounce'
});
const MEDIA_STATUS_RANK = Object.freeze({ unsub: 1, hard_bounce: 2, contact_bounce: 2, complaint: 3, blacklisted: 4 });
const rankOf = (status) => MEDIA_STATUS_RANK[status] ?? 0;
const SENDABLE_V2 = [ContactStatus.new, ContactStatus.workable];
const ORIGIN = 'toolso-emailing-v2';

/** Événement le plus bloquant d'un contact (à rang égal, le plus récent). */
const strongest = (events) =>
  events.reduce((best, e) => {
    if (!best) {
      return e;
    }
    const d = rankOf(MEDIA_STATUS_OF[e.type]) - rankOf(MEDIA_STATUS_OF[best.type]);
    return d > 0 || (d === 0 && new Date(e.date) > new Date(best.date)) ? e : best;
  }, null);

/**
 * @param {object} options
 * @param {import('sequelize').Sequelize} options.sequelize base de l'instance v2
 * @param {import('pg').Client} options.source client pg vers la base media (écrivable si apply)
 * @param {string[]} options.products uid ou id des produits media de l'instance
 * @param {Date} options.since date de bascule (obligatoire)
 * @param {boolean} [options.apply] écrire dans media (défaut : simulation)
 * @param {string} [options.instance] uid de l'instance (tracé dans contact_history.details)
 * @param {number} [options.batchSize]
 * @param {number} [options.sampleSize] exemples gardés dans le résumé (e-mails masqués)
 */
const syncStatusesToMedia = async (options) => {
  const { sequelize, source, apply = false, instance = process.env.RESOURCE_UID || null } = options;
  const batchSize = options.batchSize ?? media.DEFAULT_BATCH_SIZE;
  const sampleSize = options.sampleSize ?? 10;
  const since = options.since instanceof Date ? options.since : new Date(options.since);
  if (!options.since || isNaN(since.getTime())) {
    throw new Error('Date de bascule (since) obligatoire');
  }
  const products = await media.resolveProducts(source, options.products);
  const productIds = products.map((p) => p.id);
  const stats = {
    apply,
    instance,
    products: products.map((p) => p.uid),
    since: since.toISOString(),
    v2Events: {},
    contacts: { candidates: 0, resubscribed: 0, noMediaContact: 0, alreadyBlocked: 0, toUpdate: 0, updated: 0, conflicts: 0, scheduledEmailsDeleted: 0 },
    byStatus: {},
    inscriptions: { sendableSinceCutover: 0, missingInMedia: 0, blockedInMedia: 0 },
    samples: []
  };

  // ---------- 1. événements de statut nés dans la v2 depuis la bascule ----------
  const events = await sequelize.query(
    `SELECT e.id, e.type, e.date, e."contactId", c.email, i."inscriptionDate" AS "lastInscriptionDate"
       FROM "ContactEvent" e
       JOIN "Contact" c ON c.id = e."contactId"
       LEFT JOIN "ContactInscription" i ON i.id = c."lastInscriptionId"
      WHERE e.type IN (:types) AND e.date >= :since
        AND (e.details IS NULL OR (e.details::jsonb -> 'media') IS NULL)
        AND coalesce(e.details::jsonb ->> 'origin', '') <> 'toolso-media'
      ORDER BY e.id`,
    { replacements: { types: STATUS_EVENT_TYPES, since }, type: QueryTypes.SELECT }
  );
  const isResubscribed = (e) => e.type === EventType.unsub && e.lastInscriptionDate && new Date(e.lastInscriptionDate) > new Date(e.date);
  const byEmail = new Map();
  for (const e of events) {
    stats.v2Events[e.type] = (stats.v2Events[e.type] ?? 0) + 1;
    const email = media.normalizeEmail(e.email);
    if (!email) {
      continue;
    }
    if (isResubscribed(e)) {
      continue; // réinscrit dans la v2 après ce désabonnement : compté plus bas avec les inscriptions
    }
    if (!byEmail.has(email)) {
      byEmail.set(email, []);
    }
    byEmail.get(email).push(e);
  }
  const resubscribed = new Set(events.filter(isResubscribed).map((e) => e.contactId));
  stats.contacts.resubscribed = resubscribed.size;
  stats.contacts.candidates = byEmail.size;
  log.info(`${events.length} événements de statut v2 depuis ${stats.since} ; ${byEmail.size} contacts à reporter dans media (${stats.products.join(', ')})${apply ? '' : ' (simulation)'}`);

  // ---------- 2. rapprochement avec media et écriture par lots ----------
  const emails = [...byEmail.keys()];
  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);
    const { rows: mediaContacts } = await source.query(
      `SELECT id, product_id, lower(trim(email)) AS email, email_status FROM contact WHERE product_id = ANY($1::int[]) AND lower(trim(email)) = ANY($2::text[])`,
      [productIds, batch]
    );
    const found = new Set(mediaContacts.map((c) => c.email));
    stats.contacts.noMediaContact += batch.filter((e) => !found.has(e)).length;
    const plan = [];
    for (const mc of mediaContacts) {
      const event = strongest(byEmail.get(mc.email));
      const target = MEDIA_STATUS_OF[event.type];
      if (rankOf(mc.email_status) >= rankOf(target)) {
        stats.contacts.alreadyBlocked++;
        continue;
      }
      plan.push({ mc, event, target });
    }
    stats.contacts.toUpdate += plan.length;
    for (const { mc, event, target } of plan) {
      stats.byStatus[target] = (stats.byStatus[target] ?? 0) + 1;
      if (stats.samples.length < sampleSize) {
        stats.samples.push({
          mediaContactId: mc.id,
          product: products.find((p) => p.id === mc.product_id)?.uid,
          from: mc.email_status,
          to: target,
          v2EventId: event.id,
          date: new Date(event.date).toISOString()
        });
      }
    }
    if (!apply || plan.length === 0) {
      continue;
    }
    await source.query('BEGIN');
    try {
      for (const { mc, event, target } of plan) {
        // garde : le statut media n'a pas changé depuis la lecture
        const res = await source.query(`UPDATE contact SET email_status = $1, updated_at = now() WHERE id = $2 AND email_status IS NOT DISTINCT FROM $3`, [target, mc.id, mc.email_status]);
        if (res.rowCount === 0) {
          stats.contacts.conflicts++;
          continue;
        }
        await source.query(`INSERT INTO contact_history (product_id, contact_id, type, details, date, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, now(), now())`, [
          mc.product_id,
          mc.id,
          `emailing_${event.type}`,
          JSON.stringify({ origin: ORIGIN, instance, v2EventId: event.id, previousStatus: mc.email_status }),
          event.date
        ]);
        const del = await source.query('DELETE FROM email WHERE contact_id = $1 AND done = false', [mc.id]);
        stats.contacts.scheduledEmailsDeleted += del.rowCount;
        stats.contacts.updated++;
      }
      await source.query('COMMIT');
    } catch (err) {
      await source.query('ROLLBACK').catch(() => {});
      throw err;
    }
  }

  // ---------- 3. inscriptions v2 depuis la bascule (à réimporter dans media par l'API) ----------
  const inscriptions = await listInscriptions({ sequelize, source, productIds, since });
  stats.inscriptions.sendableSinceCutover = inscriptions.length;
  stats.inscriptions.missingInMedia = inscriptions.filter((r) => !r.mediaStatus).length;
  stats.inscriptions.blockedInMedia = inscriptions.filter((r) => r.mediaStatus && !['active', 'new'].includes(r.mediaStatus)).length;
  return stats;
};

/**
 * Contacts envoyables de la v2 dont la dernière inscription date d'après la bascule, avec leur statut media (null : absent
 * de media). Pour la réimportation par l'API media.
 */
const listInscriptions = async ({ sequelize, source, productIds, since }) => {
  const rows = await sequelize.query(
    `SELECT c.email, c.firstname, c.lastname, c.status, i."inscriptionDate", i."sourceName", s.name AS "source"
       FROM "Contact" c
       JOIN "ContactInscription" i ON i.id = c."lastInscriptionId"
       LEFT JOIN "ContactSource" s ON s.id = i."sourceId"
      WHERE i."inscriptionDate" >= :since AND c.status IN (:sendable)
      ORDER BY i."inscriptionDate"`,
    { replacements: { since, sendable: SENDABLE_V2 }, type: QueryTypes.SELECT }
  );
  const result = rows.map((r) => ({ ...r, email: media.normalizeEmail(r.email) })).filter((r) => r.email);
  const statusOf = new Map();
  for (let i = 0; i < result.length; i += 1000) {
    const batch = result.slice(i, i + 1000).map((r) => r.email);
    const { rows: found } = await source.query(`SELECT lower(trim(email)) AS email, email_status FROM contact WHERE product_id = ANY($1::int[]) AND lower(trim(email)) = ANY($2::text[])`, [
      productIds,
      batch
    ]);
    for (const f of found) {
      // plusieurs produits : on garde le statut le moins bloquant
      if (!statusOf.has(f.email) || rankOf(f.email_status) < rankOf(statusOf.get(f.email))) {
        statusOf.set(f.email, f.email_status);
      }
    }
  }
  return result.map((r) => ({ ...r, mediaStatus: statusOf.get(r.email) ?? null }));
};

module.exports = { syncStatusesToMedia, listInscriptions, MEDIA_STATUS_OF, ORIGIN };
