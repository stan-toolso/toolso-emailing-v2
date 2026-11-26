/**
 * Reprise de la configuration d'envoi d'un produit toolso-media : créneaux, expéditeurs, routeurs et configurations d'envoi.
 *
 *   email_sender (du produit)          → MailRouter (un par expéditeur media, SANS identifiants) + Sender
 *        router toolso  → MailRouter type `toolso` : endpoint http://<config.dns>:5000/sendRawEmail (MTA Haraka), IP de sortie
 *                         (ip, ip_dns, ip_bind), webhookEndpoint = <API_PUBLIC_URL>/webhooks/toolso
 *        router brevo   → MailRouter type `sib` : IP dédiée (config.ips) ; la clé d'API (credentials.apiKeyV3) est à saisir
 *                         (UI, page ESP, ou scripts/set-mail-router-credentials.js), jamais lue dans media
 *   email_sending_config               → SendingConfig : config.espSenders (répartition par ESP et poids) → config.espConfigs ;
 *                                         espScores[esp].minScore → minScoreByEsp, auto/target_or → autoUpdates
 *   email_slot                         → Schedule, toujours créé DÉSACTIVÉ (isActive = false) :
 *        recurrent / recurrent_schedule → `recurrent` (rate day) à heure fixe ; maxDaySlots N → N planifications
 *        inscription                    → `inscription` (message de bienvenue), ContactSource.apiScheduleIds des sources qui
 *                                         le référencent (contact_source.email_slot_ids / default_email_slot_id)
 *
 * Heure d'une planification `recurrent` : settings.sending_time du créneau media quand il en a une (stratégie « manual » ou
 * type recurrent_schedule) ; sinon media choisit l'heure contact par contact (heures d'ouverture du mois) et la v2 n'a pas
 * d'équivalent : l'heure vient de `slotTimes` (--slot-time), à défaut 09:00, 12:00, 15:00… (le repli de media sans
 * statistiques). La simulation affiche les heures d'envoi observées dans media sur 14 jours pour aider au choix.
 *
 * Provenance et idempotence : `config.media` = { type, id, product } sur MailRouter, SendingConfig et Schedule ; un objet
 * déjà repris est laissé tel quel (jamais réactivé ni écrasé).
 * Non repris : identifiants ESP, filtres de contacts des créneaux (format media), délai du message de bienvenue
 * (settings.delay_time), plafonds d'activation (maxNewRequests, newCapping, newRatio → réglages d'activation v2),
 * contenus rattachés aux créneaux (les DEM importées sont rattachées par l'import des campagnes).
 */
const moment = require('moment-timezone');
const log = require('../util/log').getLogger('MigrateSendingFromMedia');
const { openSource, resolveProducts } = require('./mediaDatabase');

const RECURRENT_TYPES = ['recurrent', 'recurrent_schedule'];
const DEFAULT_FIRST_HOUR = 9;
const HOUR_STEP = 3;
const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

const parseTime = (value) => {
  const m = TIME_RE.exec(String(value ?? '').trim());
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null;
};

/**
 * --slot-time : « HH:MM[,HH:MM…] » (toutes les planifications récurrentes, dans l'ordre) ou « <id créneau media>=HH:MM[,…] »
 * (répétable). Renvoie { default: [..], bySlot: { id: [..] } }.
 */
const parseSlotTimes = (values = []) => {
  const result = { default: null, bySlot: {} };
  for (const raw of [].concat(values).filter(Boolean)) {
    const [key, list] = raw.includes('=') ? raw.split('=', 2) : [null, raw];
    const times = list
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const parsed = times.map(parseTime);
    if (!times.length || parsed.some((t) => !t)) {
      throw new Error(`--slot-time invalide : « ${raw} » (attendu HH:MM[,HH:MM…] ou <id>=HH:MM[,…])`);
    }
    if (key === null) {
      result.default = parsed;
    } else {
      if (!/^\d+$/.test(key.trim())) {
        throw new Error(`--slot-time invalide : « ${raw} » (identifiant de créneau media attendu avant « = »)`);
      }
      result.bySlot[key.trim()] = parsed;
    }
  }
  return result;
};

/** Heures (HH:MM) des planifications v2 d'un créneau récurrent media, et leur origine. */
const slotTimesFor = (slot, slotTimes = { default: null, bySlot: {} }) => {
  const settings = slot.settings || {};
  const count = Math.max(1, parseInt(settings.maxDaySlots ?? 1, 10) || 1);
  const explicit = slotTimes.bySlot?.[String(slot.id)] ?? slotTimes.default;
  if (explicit) {
    return { times: explicit.slice(0, Math.max(count, explicit.length)), origin: 'option' };
  }
  const fixed = parseTime(settings.sending_time);
  if (fixed && (slot.type === 'recurrent_schedule' || (count === 1 && settings.sending_time_strategy === 'manual'))) {
    return { times: [fixed], origin: 'media' };
  }
  const times = [];
  for (let i = 0; i < count; i++) {
    times.push(`${String(Math.min(23, DEFAULT_FIRST_HOUR + HOUR_STEP * i)).padStart(2, '0')}:00`);
  }
  return { times, origin: 'default' };
};

const mediaTag = (type, id, product) => ({ type, id: Number(id), product: product.uid });

/** Routeur v2 d'un expéditeur media (sans identifiants). */
const routerFor = (sender, product, { apiPublicUrl }) => {
  const cfg = sender.config || {};
  const base = { media: mediaTag('email_sender', sender.id, product) };
  if (sender.router === 'toolso') {
    return {
      name: `${sender.name || sender.email} (media #${sender.id})`,
      type: 'toolso',
      config: {
        ...base,
        endpoint: cfg.dns ? `http://${cfg.dns}:5000/sendRawEmail` : null,
        ip: cfg.ip ?? null,
        ip_dns: cfg.dns ?? null,
        ip_bind: cfg.ip_bind ?? null,
        webhookEndpoint: apiPublicUrl ? `${apiPublicUrl.replace(/\/$/, '')}/webhooks/toolso` : null
      },
      needsCredentials: false
    };
  }
  if (sender.router === 'brevo' || sender.router === 'sendinblue' || sender.router === 'sib') {
    return {
      name: `${sender.name || sender.email} (media #${sender.id})`,
      type: 'sib',
      config: { ...base, ips: cfg.ip ? [{ ip: cfg.ip, weight: 100 }] : [] },
      needsCredentials: true
    };
  }
  return null;
};

/** media email_sending_config.config → SendingConfig.config.espConfigs v2 (senderIds : id media → id v2). */
const convertSendingConfig = (mediaConfig, senderIds) => {
  const espSenders = mediaConfig?.espSenders || {};
  const espScores = mediaConfig?.espScores || {};
  const groups = new Map();
  const warnings = [];
  for (const [esp, def] of Object.entries(espSenders)) {
    const senders = (def?.senders || []).filter((s) => {
      if (!senderIds.has(Number(s.id))) {
        warnings.push(`ESP ${esp} : expéditeur media #${s.id} non repris (routeur inconnu ou autre produit), ignoré`);
        return false;
      }
      return true;
    });
    if (!senders.length) {
      continue;
    }
    const key = JSON.stringify(senders.map((s) => [Number(s.id), Number(s.weight ?? 100)]));
    if (!groups.has(key)) {
      groups.set(key, { esps: [], isDefault: false, senders });
    }
    if (esp === 'default') {
      groups.get(key).isDefault = true;
    } else {
      groups.get(key).esps.push(esp);
    }
  }
  const scoreOf = (esp) => {
    const s = espScores[esp] ?? espScores.default;
    return s && typeof s.minScore === 'number' ? s : null;
  };
  // ESP qui ont un seuil propre (espScores) sans expéditeurs propres (espSenders) : media les envoie avec les
  // expéditeurs par défaut, mais à leur seuil. On les liste dans le groupe par défaut, sinon leur seuil serait perdu.
  const defaultGroup = [...groups.values()].find((g) => g.isDefault);
  if (defaultGroup) {
    const grouped = new Set([...groups.values()].flatMap((g) => g.esps));
    for (const esp of Object.keys(espScores)) {
      if (esp !== 'default' && !grouped.has(esp) && scoreOf(esp)) {
        defaultGroup.esps.push(esp);
      }
    }
  }
  const espConfigs = [];
  for (const group of groups.values()) {
    const esps = group.isDefault ? ['default', ...group.esps] : group.esps;
    espConfigs.push({
      esps: group.esps,
      default: group.isDefault,
      senders: group.senders.map((s) => {
        const minScoreByEsp = {};
        const minNewScoreByEsp = {};
        const autoUpdates = {};
        for (const esp of esps) {
          const score = scoreOf(esp);
          if (score) {
            minScoreByEsp[esp] = score.minScore;
            // nouveaux contacts : seuil media (minNewScore) ; aucun si media n'en autorise aucun (maxNewRequests = 0)
            if (Number(score.maxNewRequests) === 0) {
              minNewScoreByEsp[esp] = 101;
            } else if (typeof score.minNewScore === 'number') {
              minNewScoreByEsp[esp] = score.minNewScore;
            }
            autoUpdates[esp] = { enabled: !!score.auto, minOpenRate: typeof score.target_or === 'number' ? score.target_or : 19 };
          }
        }
        return { senderId: senderIds.get(Number(s.id)), weight: Number(s.weight ?? 100), minScoreByEsp, minNewScoreByEsp, autoUpdates };
      })
    });
  }
  for (const [esp, score] of Object.entries(espScores)) {
    if (score && score.score === 'openScore') {
      warnings.push(`ESP ${esp} : media le sélectionne sur son score d'ouverture (openScore), la v2 sur activityScore : vérifier les volumes`);
    }
    if (score && Number(score.maxNewRequests) > 0) {
      warnings.push(`ESP ${esp} : plafond media de ${score.maxNewRequests} nouveaux contacts par envoi non repris (la v2 n'en a pas) : vérifier les volumes`);
    }
  }
  // le groupe par défaut en premier (ContentSender prend le premier `default`, puis l'ESP exact)
  espConfigs.sort((a, b) => Number(b.default) - Number(a.default));
  return { espConfigs, warnings };
};

const loadMedia = async (source, products) => {
  const ids = products.map((p) => p.id);
  const rows = async (sql) => (await source.query(sql, [ids])).rows;
  // config des expéditeurs : seulement les clés non secrètes (jamais apikey / mots de passe)
  const senders = await rows(
    `SELECT id, product_id, name, email, sender_name, reply_to_name, reply_to_email, unsubscribe_mail_to, router,
            jsonb_build_object('ip', config->>'ip', 'dns', config->>'dns', 'ip_bind', config->>'ip_bind') AS config,
            (config ? 'apikey') AS has_apikey
       FROM email_sender WHERE product_id = ANY($1::int[]) ORDER BY id`
  );
  const sendingConfigs = await rows(`SELECT id, product_id, name, config - 'espScoresHistory' AS config FROM email_sending_config WHERE product_id = ANY($1::int[]) ORDER BY id`);
  const slots = await rows(`SELECT id, product_id, name, type, is_active, sending_config_id, settings FROM email_slot WHERE product_id = ANY($1::int[]) ORDER BY id`);
  const slotContents = await rows(
    `SELECT s.email_slot_id, c.id, c.name, c.type FROM email_slot_content s JOIN email_content c ON c.id = s.email_content_id WHERE s.product_id = ANY($1::int[]) ORDER BY s.email_slot_id, c.id`
  );
  const sources = await rows(`SELECT id, product_id, name, default_email_slot_id, email_slot_ids FROM contact_source WHERE product_id = ANY($1::int[]) ORDER BY id`);
  const settings = await rows(`SELECT product_id, name, value FROM settings WHERE (product_id = ANY($1::int[]) OR product_id IS NULL) AND name = 'timezone'`);
  return { senders, sendingConfigs, slots, slotContents, sources, settings };
};

/** Heures d'envoi observées par créneau sur 14 jours (aide au choix des heures fixes ; simulation seulement). */
const observedHours = async (source, products, timezone) => {
  const { rows } = await source.query(
    `SELECT slot_id, extract(hour FROM sent_at AT TIME ZONE $2)::int AS hour, count(*)::int AS n
       FROM email WHERE product_id = ANY($1::int[]) AND sent_at >= now() - interval '14 days' AND slot_id IS NOT NULL
      GROUP BY 1, 2 ORDER BY 1, 3 DESC`,
    [products.map((p) => p.id), timezone]
  );
  const bySlot = {};
  for (const r of rows) {
    (bySlot[r.slot_id] = bySlot[r.slot_id] || []).push({ hour: r.hour, emails: r.n });
  }
  for (const k of Object.keys(bySlot)) {
    bySlot[k] = bySlot[k].slice(0, 5);
  }
  return bySlot;
};

const findByMedia = (items, type, id) => items.find((i) => i.config && i.config.media && i.config.media.type === type && Number(i.config.media.id) === Number(id));

/**
 * @param {object} opts
 * @param {import('sequelize').Sequelize} opts.sequelize base de l'instance
 * @param {string} [opts.sourceUrl] URL de la base media (ou opts.source : client pg déjà connecté)
 * @param {string[]} opts.products uid ou id des produits media
 * @param {boolean} [opts.senders=true] expéditeurs, routeurs, configurations d'envoi
 * @param {boolean} [opts.slots=true] créneaux → planifications (désactivées)
 * @param {string[]} [opts.slotTimes] valeurs de --slot-time
 * @param {string} [opts.trackingDomain] Sender.trackingDomain (ex. https://lk.exemple.com) ; défaut : 1er de TRACKING_HOSTS
 * @param {boolean} [opts.dryRun=false]
 */
const migrateSendingFromMedia = async ({
  sequelize,
  sourceUrl,
  source: givenSource,
  products: selection,
  senders: doSenders = true,
  slots: doSlots = true,
  slotTimes,
  trackingDomain,
  apiPublicUrl,
  dryRun = false
}) => {
  const { MailRouter, Sender, SendingConfig, Schedule, ContactSource, Settings } = sequelize.models;
  const source = givenSource || (await openSource(sourceUrl));
  const parsedTimes = parseSlotTimes(slotTimes);
  apiPublicUrl = apiPublicUrl ?? process.env.API_PUBLIC_URL ?? null;
  if (trackingDomain === undefined) {
    const first = (process.env.TRACKING_HOSTS || '').split(/[\s,]+/).filter(Boolean)[0];
    trackingDomain = first ? `https://${first}` : null;
  }
  if (trackingDomain && !/^https?:\/\//.test(trackingDomain)) {
    trackingDomain = `https://${trackingDomain}`;
  }
  const stats = {
    dryRun,
    products: [],
    routers: { created: 0, existing: 0, skipped: 0 },
    senders: { created: 0, existing: 0 },
    sendingConfigs: { created: 0, existing: 0 },
    schedules: { created: 0, existing: 0 },
    sourcesLinked: 0,
    plan: { routers: [], sendingConfigs: [], schedules: [] },
    credentialsToEnter: [],
    warnings: []
  };
  try {
    const products = await resolveProducts(source, selection);
    stats.products = products.map((p) => ({ id: p.id, uid: p.uid, name: p.name }));
    const media = await loadMedia(source, products);
    const productById = new Map(products.map((p) => [p.id, p]));
    const globalTz = media.settings.find((s) => s.product_id === null)?.value;
    const mediaTz = (productId) => media.settings.find((s) => s.product_id === productId)?.value || globalTz || 'Europe/Paris';
    const tzRow = await Settings.findOne({ where: { name: 'timezone' } });
    const v2Tz = tzRow?.value || 'Europe/Paris';
    const observed = dryRun && doSlots ? await observedHours(source, products, mediaTz(products[0].id)) : {};
    const multi = products.length > 1;
    const label = (product, name) => (multi ? `${product.name} – ${name}` : name);

    const t = dryRun ? null : await sequelize.transaction();
    const opt = t ? { transaction: t } : {};
    try {
      // ---------- expéditeurs et routeurs ----------
      const senderIds = new Map(); // id media → id v2 (simulation : id négatif fictif)
      const routers = await MailRouter.findAll(opt);
      if (doSenders || doSlots) {
        for (const ms of media.senders) {
          const product = productById.get(ms.product_id);
          const def = routerFor(ms, product, { apiPublicUrl });
          if (!def) {
            stats.routers.skipped++;
            stats.warnings.push(`Expéditeur media #${ms.id} « ${ms.name} » : routeur « ${ms.router} » non géré, non repris`);
            continue;
          }
          let router = findByMedia(routers, 'email_sender', ms.id);
          let sender = router ? await Sender.findOne({ where: { mailRouterId: router.id }, ...opt }) : null;
          stats.plan.routers.push({
            media: ms.id,
            name: def.name,
            type: def.type,
            endpoint: def.config.endpoint ?? undefined,
            ip: def.config.ip ?? def.config.ips?.[0]?.ip ?? null,
            email: ms.email,
            existing: !!router
          });
          if (def.type === 'toolso' && !def.config.endpoint) {
            stats.warnings.push(`Expéditeur media #${ms.id} : routeur toolso sans config.dns, endpoint à renseigner dans l'UI`);
          }
          if (!doSenders) {
            if (sender) {
              senderIds.set(Number(ms.id), sender.id);
            }
            continue;
          }
          if (router) {
            stats.routers.existing++;
          } else if (!dryRun) {
            router = await MailRouter.create({ name: def.name, type: def.type, config: def.config, credentials: null }, opt);
            routers.push(router);
            stats.routers.created++;
          } else {
            stats.routers.created++;
          }
          if (def.needsCredentials && (!router || !router.credentials)) {
            stats.credentialsToEnter.push({ mailRouterId: router ? router.id : null, name: def.name, type: def.type, mediaHadApiKey: !!ms.has_apikey });
          }
          if (sender) {
            stats.senders.existing++;
          } else if (!dryRun) {
            sender = await Sender.create(
              {
                name: ms.name,
                email: ms.email,
                senderName: ms.sender_name,
                replyToName: ms.reply_to_name,
                replyToEmail: ms.reply_to_email,
                unsubscribeMailto: ms.unsubscribe_mail_to,
                trackingDomain,
                mailRouterId: router.id,
                deleted: false
              },
              opt
            );
            stats.senders.created++;
          } else {
            stats.senders.created++;
          }
          senderIds.set(Number(ms.id), sender ? sender.id : -Number(ms.id));
        }
      }

      // ---------- configurations d'envoi ----------
      const sendingConfigIds = new Map();
      const existingConfigs = await SendingConfig.findAll(opt);
      for (const mc of media.sendingConfigs) {
        const product = productById.get(mc.product_id);
        let sc = findByMedia(existingConfigs, 'email_sending_config', mc.id);
        if (sc) {
          stats.sendingConfigs.existing++;
          sendingConfigIds.set(Number(mc.id), sc.id);
          stats.plan.sendingConfigs.push({ media: mc.id, name: sc.name, existing: true });
          continue;
        }
        if (!doSenders) {
          continue;
        }
        const { espConfigs, warnings } = convertSendingConfig(mc.config, senderIds);
        stats.warnings.push(...warnings.map((w) => `Configuration d'envoi media #${mc.id} : ${w}`));
        const name = label(product, mc.name || `Configuration ${mc.id}`);
        stats.plan.sendingConfigs.push({ media: mc.id, name, espConfigs, existing: false });
        if (!dryRun) {
          sc = await SendingConfig.create({ name, config: { espConfigs, media: mediaTag('email_sending_config', mc.id, product) }, history: [] }, opt);
          sendingConfigIds.set(Number(mc.id), sc.id);
        }
        stats.sendingConfigs.created++;
      }

      // ---------- créneaux → planifications (désactivées) ----------
      if (doSlots) {
        const existingSchedules = await Schedule.findAll({ where: { parentId: null }, ...opt });
        const inscriptionIds = new Map();
        for (const slot of media.slots) {
          const product = productById.get(slot.product_id);
          const settings = slot.settings || {};
          const contents = media.slotContents.filter((c) => c.email_slot_id === slot.id).map((c) => c.name);
          const sendingConfigId = slot.sending_config_id ? sendingConfigIds.get(Number(slot.sending_config_id)) ?? null : null;
          if (slot.sending_config_id && sendingConfigId === null && !dryRun) {
            stats.warnings.push(`Créneau media #${slot.id} : configuration d'envoi #${slot.sending_config_id} non reprise (relancer avec les expéditeurs), planification sans configuration`);
          }
          if (settings.contactsFilter) {
            stats.warnings.push(`Créneau media #${slot.id} « ${slot.name} » : filtre de contacts media non converti, à recréer dans l'UI`);
          }
          const baseConfig = (extra) => ({ media: { ...mediaTag('email_slot', slot.id, product), slotType: slot.type, wasActive: !!slot.is_active, ...extra } });
          if (slot.type === 'inscription') {
            if (settings.delay_time) {
              stats.warnings.push(`Créneau media #${slot.id} « ${slot.name} » : délai ${settings.delay_time} du message de bienvenue non repris (envoi immédiat en v2)`);
            }
            let schedule = findByMedia(existingSchedules, 'email_slot', slot.id);
            stats.plan.schedules.push({ media: slot.id, name: label(product, slot.name), type: 'inscription', mediaActive: !!slot.is_active, contents, existing: !!schedule });
            if (schedule) {
              stats.schedules.existing++;
            } else {
              if (!dryRun) {
                schedule = await Schedule.create(
                  {
                    name: label(product, slot.name),
                    type: 'inscription',
                    status: 'waiting',
                    isActive: false,
                    uniqueContent: false,
                    rate: null,
                    scheduleDate: null,
                    config: baseConfig({}),
                    sendingConfigId
                  },
                  opt
                );
              }
              stats.schedules.created++;
            }
            if (schedule) {
              inscriptionIds.set(Number(slot.id), schedule.id);
              stats.plan.schedules[stats.plan.schedules.length - 1].id = schedule.id;
            }
            continue;
          }
          if (!RECURRENT_TYPES.includes(slot.type)) {
            stats.warnings.push(`Créneau media #${slot.id} « ${slot.name} » : type « ${slot.type} » non géré, non repris`);
            continue;
          }
          const { times, origin } = slotTimesFor(slot, parsedTimes);
          const tz = mediaTz(slot.product_id);
          if (tz !== v2Tz) {
            stats.warnings.push(`Créneau media #${slot.id} : fuseau media ${tz} ≠ fuseau de l'instance ${v2Tz} (heures données dans le fuseau de l'instance)`);
          }
          if (origin === 'default') {
            stats.warnings.push(
              `Créneau media #${slot.id} « ${slot.name} » : heure choisie par contact dans media (pas d'heure fixe) → ${times.join(', ')} par défaut ; préciser --slot-time ${slot.id}=HH:MM`
            );
          }
          for (const [index, time] of times.entries()) {
            const name = label(product, times.length > 1 ? `${slot.name} ${time}` : slot.name);
            const existing = existingSchedules.find((s) => s.config?.media?.type === 'email_slot' && Number(s.config.media.id) === Number(slot.id) && (s.config.media.index ?? 0) === index);
            const planned = {
              id: existing?.id ?? null,
              media: slot.id,
              name,
              type: 'recurrent',
              time,
              timeOrigin: origin,
              timezone: v2Tz,
              mediaActive: !!slot.is_active,
              contents,
              observedHours: observed[slot.id],
              existing: !!existing
            };
            stats.plan.schedules.push(planned);
            if (existing) {
              stats.schedules.existing++;
              continue;
            }
            stats.schedules.created++;
            if (dryRun) {
              continue;
            }
            const [h, m] = time.split(':').map(Number);
            const scheduleDate = moment.tz(v2Tz).startOf('day').hour(h).minute(m).toDate();
            const config = baseConfig({ index, maxDaySlots: settings.maxDaySlots ?? 1 });
            const created = await Schedule.create({ name, type: 'recurrent', status: 'waiting', isActive: false, uniqueContent: true, rate: 'day', scheduleDate, config, sendingConfigId }, opt);
            planned.id = created.id;
            existingSchedules.push(created);
          }
        }
        // sources : créneaux d'inscription référencés
        for (const ms of media.sources) {
          const refs = [...(Array.isArray(ms.email_slot_ids) ? ms.email_slot_ids : []), ms.default_email_slot_id].filter((id) => id !== null && id !== undefined).map(Number);
          const ids = [...new Set(refs.map((id) => inscriptionIds.get(id)).filter(Boolean))];
          if (!ids.length) {
            continue;
          }
          const target = await ContactSource.findOne({ where: { name: ms.name }, ...opt });
          if (!target) {
            stats.warnings.push(`Source media « ${ms.name} » absente de l'instance (reprendre les contacts d'abord) : planification d'inscription non rattachée`);
            continue;
          }
          const current = Array.isArray(target.apiScheduleIds) ? target.apiScheduleIds.map(Number) : [];
          const merged = [...new Set([...current, ...ids])];
          if (merged.length !== current.length) {
            stats.sourcesLinked++;
            if (!dryRun) {
              await target.update({ apiScheduleIds: merged }, opt);
            }
          }
        }
      }
      if (t) {
        await t.commit();
      }
    } catch (err) {
      if (t) {
        await t.rollback();
      }
      throw err;
    }
    if (stats.credentialsToEnter.length) {
      log.warn(`${stats.credentialsToEnter.length} routeur(s) sans identifiants : à saisir (UI, page ESP) avant tout envoi`);
    }
    return stats;
  } finally {
    if (!givenSource) {
      await source.end().catch(() => {});
    }
  }
};

module.exports = { migrateSendingFromMedia, convertSendingConfig, routerFor, slotTimesFor, parseSlotTimes };
