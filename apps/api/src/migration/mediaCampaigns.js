const crypto = require('crypto');
const moment = require('moment-timezone');
const { QueryTypes } = require('sequelize');
const ContentType = require('../storage/models/ContentType');
const { openSource, normalizeGender } = require('./mediaDatabase');
const { loadDemAds, adTargetsProduct, demProductContext, convertDem, demContentName, demMediaConfig, isOn } = require('./mediaContents');
const log = require('../util/log').getLogger('MediaCampaigns');

/**
 * Import des campagnes media (base ads : campagnes, groupes, publicités DEM) en `Content` v2, à relancer régulièrement
 * (job `media_campaigns_import` du scheduler) tant que les DEM sont gérées dans toolso-ads :
 *
 *   publicité disponible pour le produit (règles de media, ci-dessous)  → Content marketing **actif** (créé ou réactivé)
 *   publicité qui ne l'est plus (désactivée, archivée, hors période…)   → Content désactivé
 *   publicité modifiée dans media (HTML, objet, filtres…)               → version par défaut du Content mise à jour
 *
 * Règles de media reprises (`AdService` filtre `available` et `bestAd`, heure de Paris) : publicité `enabled` et de statut
 * active / learning / limited, groupe `enabled` et `active`, campagne `enabled` ; annonceur du client (paramètre media
 * `advertisers`) ou campagne publique d'un autre annonceur ; période (`distribution_settings.period` MM-JJ), début et fin
 * (`start`, `end`) ; `ad_group.support_settings.productIds` ; `ad.support_settings.slotNames` (variable `dem` /
 * `dem_template`) ; plafond quotidien de requêtes (`daily_capping_requests` / `ad_group.today_requests`).
 * Traduits en réglages v2 : jours de diffusion → filtre `daysInclude`, audience (âge, sexe, codes postaux, date de
 * naissance, ESP, champ du contact) → `Content.config.filters`, `weight` → `config.weight`, fin → `endDate`.
 * Sans équivalent (signalés dans `unsupported`, la publicité reste active) : plafonds totaux et quotidiens de clics /
 * impressions (statistiques media), stratégie de tri. Audience non traduisible (`or` à plusieurs branches,
 * `email_status`…) : contenu créé **inactif** (`unavailable.audience`), à régler à la main.
 *
 * Liens et utm : le HTML est converti comme le fait media à l'envoi (`convertDem`) ; les utm écrits dans les publicités
 * (`utm_campaign={{campaign.id}}-{{ad_group.id}}-{{ad.id}}&utm_source={{product.uid}}`) sont résolus avec les mêmes valeurs.
 * Les liens de désabonnement media (pied de page DEM, `emailingUnsubUrl`, `unsubscribe.<site>`, liens `toolso:unsub`)
 * deviennent `{{{unsubLink}}}` : le désabonnement se fait dans la v2 (`unsubLinksReplaced` : liens remplacés dans les
 * contenus créés ou mis à jour par ce passage).
 *
 * Planifications : sans `schedules`, les contenus ne sont rattachés à aucune planification (mode « sans envoi » d'avant la
 * bascule). Avec une liste d'identifiants de `Schedule`, chaque contenu importé y est rattaché (ContentSchedule).
 *
 * Un contenu dont `config.media.manual` vaut true n'est plus touché (repris à la main dans l'UI). Un contenu suspendu par
 * la v2 (`suspended`, ex. check_contents_stats) n'est pas réactivé.
 */

const MEDIA_TZ = 'Europe/Paris';
const AVAILABLE_AD_STATUSES = ['active', 'learning', 'limited'];

const isFilled = (v) => v !== null && v !== undefined && v !== '';

/**
 * Disponibilité d'une publicité pour un produit à un instant donné, d'après les règles de media.
 * @returns {{ available: boolean, reasons: string[] }}
 */
const adAvailability = (ad, { productId, advertiserIds = [], now = new Date() }) => {
  const reasons = [];
  const group = ad.ad_group ?? {};
  const campaign = ad.campaign ?? {};
  const ds = group.distribution_settings ?? {};
  const today = moment.tz(now, MEDIA_TZ);
  const day = today.format('YYYY-MM-DD');
  const period = today.format('MM-DD');
  if (!adTargetsProduct(ad, productId)) {
    reasons.push('product');
  }
  const slotNames = ad.support_settings?.slotNames ?? [];
  if (slotNames.length > 0 && !slotNames.includes(ad.format)) {
    reasons.push('slot');
  }
  if (!isOn(ad.enabled) || !AVAILABLE_AD_STATUSES.includes(ad.status)) {
    reasons.push('ad_disabled');
  }
  if (!isOn(group.enabled) || group.status !== 'active') {
    reasons.push('ad_group_disabled');
  }
  if (!isOn(campaign.enabled)) {
    reasons.push('campaign_disabled');
  }
  const ownAdvertiser = ad.advertiser_id != null && advertiserIds.map(String).includes(String(ad.advertiser_id));
  if (!ownAdvertiser && campaign.public !== true) {
    reasons.push('advertiser');
  }
  const p = ds.period && typeof ds.period === 'object' ? ds.period : null;
  if (p && isFilled(p.start)) {
    const ok = p.start <= p.end ? p.start <= period && p.end >= period : p.start <= period || p.end >= period;
    if (!ok) {
      reasons.push('period');
    }
  }
  if (isFilled(ds.start) && !(String(ds.start) <= day)) {
    reasons.push('not_started');
  }
  if (isFilled(ds.end) && !(String(ds.end) >= day)) {
    reasons.push('ended');
  }
  if (ds.daily_capping_requests && (group.today_requests ?? 0) >= ds.daily_capping_requests) {
    reasons.push('daily_capping');
  }
  return { available: reasons.length === 0, reasons };
};

/**
 * Traduit un filtre d'audience media (arbre and / or) en filtres de contenu v2 (liste, tous requis).
 * @returns {{ filters: object[], unsupported: string[] }}
 */
const convertAudience = (node) => {
  const filters = [];
  const unsupported = [];
  const walk = (f) => {
    if (!f || typeof f !== 'object' || !f.type) {
      return;
    }
    switch (f.type) {
      case 'and':
        (f.children ?? []).forEach(walk);
        return;
      case 'or': {
        const children = (f.children ?? []).filter((c) => c && c.type);
        if (children.length === 1) {
          walk(children[0]);
        } else if (children.length > 1) {
          unsupported.push('or');
        }
        return;
      }
      case 'age':
        if (f.minAge || f.maxAge) {
          filters.push({ type: 'age', ...(f.minAge ? { minAge: Number(f.minAge) } : {}), ...(f.maxAge ? { maxAge: Number(f.maxAge) } : {}) });
        }
        return;
      case 'gender': {
        if (f.gender) {
          const gender = normalizeGender(String(f.gender));
          if (gender) {
            filters.push({ type: 'gender', gender });
          } else {
            unsupported.push(`gender:${f.gender}`);
          }
        }
        return;
      }
      case 'zipcodePrefixes':
        if (f.values) {
          filters.push({ type: 'zipcodePrefixes', subType: f.subType === 'exclude' ? 'exclude' : 'include', values: String(f.values) });
        } else if (f.subType !== 'exclude') {
          unsupported.push('zipcodePrefixes:empty');
        }
        return;
      case 'dob':
        if (f.subType === 'birthday') {
          filters.push({ type: 'dob', subType: 'birthday' });
        } else if (f.subType === 'period' && f.from && f.to) {
          filters.push({ type: 'dob', subType: 'period', from: f.from, to: f.to });
        }
        return;
      case 'esp':
        if (f.subType && Array.isArray(f.esps)) {
          filters.push({ type: f.subType === 'exclude' ? 'espExclude' : 'espInclude', esps: f.esps });
        }
        return;
      case 'contactField':
        if (f.field && f.operator) {
          filters.push({ type: 'fieldValue', field: f.field === 'custom' ? 'customFields' : f.field, ...(f.field === 'custom' ? { customField: f.customField } : {}), operator: f.operator, value: f.value });
        } else {
          unsupported.push('contactField');
        }
        return;
      default:
        unsupported.push(f.type);
    }
  };
  walk(node);
  return { filters, unsupported };
};

/** Réglages de diffusion du groupe traduits en champs v2, et ce qui n'a pas d'équivalent. */
const distributionToV2 = (ad) => {
  const ds = ad.ad_group?.distribution_settings ?? {};
  const filters = [];
  const unsupported = [];
  if (Array.isArray(ds.days) && ds.days.length > 0) {
    filters.push({ type: 'daysInclude', days: ds.days.map(Number) });
  }
  for (const key of ['capping_requests', 'capping_impressions', 'capping_clicks', 'daily_capping_impressions', 'daily_capping_clicks']) {
    if (ds[key]) {
      unsupported.push(key);
    }
  }
  const endDate = isFilled(ds.end) && /^\d{4}-\d{2}-\d{2}/.test(String(ds.end)) ? moment.tz(String(ds.end).slice(0, 10), 'YYYY-MM-DD', MEDIA_TZ).endOf('day').toDate() : null;
  const weight = ds.weight !== undefined && ds.weight !== null && ds.weight !== '' && !isNaN(Number(ds.weight)) ? Number(ds.weight) : undefined;
  return { filters, unsupported, endDate, weight };
};

const hashOf = (value) => crypto.createHash('sha1').update(JSON.stringify(value)).digest('hex');

/** utm des liens d'un HTML (pour le compte rendu et la vérification). */
const extractUtms = (html) => {
  const out = new Set();
  for (const m of String(html ?? '').matchAll(/[?&](?:amp;)?(utm_(?:campaign|source|medium))=([^&"'#\s]*)/g)) {
    out.add(`${m[1]}=${m[2]}`);
  }
  return [...out];
};

/** Produits media par uid ou identifiant (sans compter les contacts : requête légère, relancée chaque heure). */
const findProducts = async (source, selection) => {
  const keys = selection.map((k) => String(k).trim()).filter(Boolean);
  const { rows } = await source.query('SELECT id, uid, name, main_domain FROM product WHERE uid = ANY($1::text[]) OR id::text = ANY($1::text[]) ORDER BY id', [keys]);
  const missing = keys.filter((k) => !rows.some((p) => p.uid === k || String(p.id) === k));
  if (missing.length > 0) {
    throw new Error(`Produit(s) media introuvable(s) : ${missing.join(', ')}`);
  }
  return rows;
};

/** Annonceurs propres au client media (paramètre global `advertisers`, liste d'objets { id }). */
const ownAdvertiserIds = async (source) => {
  const { rows } = await source.query(`SELECT value FROM settings WHERE name = 'advertisers' AND product_id IS NULL LIMIT 1`);
  let value = rows[0]?.value;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch (e) {
      value = null;
    }
  }
  return Array.isArray(value) ? value.map((a) => (a && typeof a === 'object' ? a.id : a)).filter((id) => id !== null && id !== undefined) : [];
};

const newStats = () => ({
  products: [],
  advertisers: 0,
  ads: { read: 0, targeting: 0, available: 0 },
  contents: { created: 0, updated: 0, activated: 0, deactivated: 0, unchanged: 0, manual: 0, suspended: 0, orphaned: 0, noTemplate: 0 },
  unavailable: {},
  unsupported: {},
  tsClick: { applied: 0, skipped: 0 },
  unsubLinksReplaced: 0,
  schedules: { ids: [], linked: 0 },
  samples: []
});

const bump = (obj, key, n = 1) => {
  obj[key] = (obj[key] ?? 0) + n;
};

/**
 * @param {object} options
 * @param {import('sequelize').Sequelize} options.sequelize
 * @param {string} [options.sourceUrl] base media (ou `source`)
 * @param {import('pg').Client} [options.source]
 * @param {string} [options.adsUrl] base ads (ou `ads`)
 * @param {import('pg').Client} [options.ads]
 * @param {string[]} options.products uid(s) ou identifiant(s) des produits media de l'instance
 * @param {number[]} [options.schedules] planifications v2 auxquelles rattacher les contenus (défaut : aucune)
 * @param {Date} [options.now]
 * @param {boolean} [options.dryRun]
 * @param {number} [options.samples] nombre de contenus décrits dans le compte rendu (défaut 5)
 */
const importMediaCampaigns = async (options) => {
  const { sequelize, dryRun = false, now = new Date(), schedules = [] } = options;
  const { Content, ContentVersion } = sequelize.models;
  const stats = newStats();
  stats.dryRun = dryRun;
  stats.schedules.ids = schedules;
  if (!options.products || options.products.length === 0) {
    throw new Error('Aucun produit media (MEDIA_PRODUCTS).');
  }
  const ownSource = !options.source;
  const ownAds = !options.ads;
  const source = options.source ?? (await openSource(options.sourceUrl));
  let ads;
  try {
    ads = options.ads ?? (await openSource(options.adsUrl));
  } catch (err) {
    if (ownSource) {
      await source.end().catch(() => {});
    }
    throw err;
  }
  const transaction = await sequelize.transaction();
  try {
    const products = await findProducts(source, options.products);
    stats.products = products.map((p) => p.uid);
    const advertiserIds = await ownAdvertiserIds(source);
    stats.advertisers = advertiserIds.length;
    const contexts = [];
    for (const product of products) {
      contexts.push(await demProductContext(source, product));
    }
    const allAds = await loadDemAds(ads, products.map((p) => p.id));
    stats.ads.read = allAds.length;

    if (schedules.length > 0) {
      const found = await sequelize.models.Schedule.count({ where: { id: schedules }, transaction });
      if (found !== schedules.length) {
        throw new Error(`Planification(s) introuvable(s) parmi ${schedules.join(', ')} (MEDIA_CAMPAIGNS_SCHEDULES).`);
      }
    }

    const existingRows = await sequelize.query(`SELECT id, config->'media'->>'id' AS media_id FROM "Content" WHERE config->'media'->>'type' = 'dem'`, { type: QueryTypes.SELECT, transaction });
    const existingByAd = new Map(existingRows.map((r) => [String(r.media_id), r.id]));
    const seen = new Set();
    const managedIds = [];

    for (const ad of allAds) {
      // premier produit de l'instance pour lequel la publicité est disponible, sinon le premier qu'elle cible
      let ctx = null;
      let availability = null;
      for (const c of contexts) {
        const a = adAvailability(ad, { productId: c.product.id, advertiserIds, now });
        if (a.available) {
          ctx = c;
          availability = a;
          break;
        }
        if (!ctx && !a.reasons.includes('product')) {
          ctx = c;
          availability = a;
        }
      }
      if (!ctx) {
        continue; // ne cible aucun produit de l'instance
      }
      stats.ads.targeting++;
      const contentId = existingByAd.get(String(ad.id));
      if (!availability.available && !contentId) {
        for (const r of availability.reasons) {
          bump(stats.unavailable, r);
        }
        continue; // jamais importée tant qu'elle n'est pas disponible
      }
      seen.add(String(ad.id));

      const audience = convertAudience(ad.ad_group?.audience_settings);
      const distribution = distributionToV2(ad);
      const reasons = [...availability.reasons];
      if (audience.unsupported.length > 0) {
        reasons.push('audience');
      }
      for (const u of [...audience.unsupported.map((u) => `audience:${u}`), ...distribution.unsupported]) {
        bump(stats.unsupported, u);
      }
      const available = reasons.length === 0;
      if (available) {
        stats.ads.available++;
      } else {
        for (const r of reasons) {
          bump(stats.unavailable, r);
        }
      }

      const converted = convertDem(ad, ctx);
      if (!converted) {
        stats.contents.noTemplate++;
        bump(stats.unavailable, 'no_dem_template');
        continue;
      }
      stats.tsClick.applied += converted.tsClick.applied;
      stats.tsClick.skipped += converted.tsClick.skipped;
      const filters = [...distribution.filters, ...audience.filters];
      const name = demContentName(ad);
      const category = ad.advertiser_name ? String(ad.advertiser_name).slice(0, 255) : null;
      const version = { html: converted.html, subject: (converted.subject ?? '').slice(0, 255), previewText: (converted.previewText ?? '').slice(0, 255), senderName: (converted.senderName ?? '').slice(0, 255) };
      const hash = hashOf({ name, category, version, filters, endDate: distribution.endDate, weight: distribution.weight });
      const sync = { hash, syncedAt: now.toISOString(), available, reasons, unsupported: [...audience.unsupported.map((u) => `audience:${u}`), ...distribution.unsupported] };
      const mediaConfig = { ...demMediaConfig(ad, ctx.product), sync };

      if (!contentId) {
        const content = await Content.create(
          { name, type: ContentType.marketing, isActive: available, category, endDate: distribution.endDate, config: { media: mediaConfig, filters, ...(distribution.weight !== undefined ? { weight: distribution.weight } : {}) } },
          { transaction }
        );
        const contentVersion = await ContentVersion.create({ name: 'Default Version', contentId: content.id, isDefault: true, contentTemplateId: null, templateVariables: {}, frenchEspsSubject: '', ...version }, { transaction });
        content.defaultVersionId = contentVersion.id;
        await content.save({ transaction });
        stats.contents.created++;
        stats.unsubLinksReplaced += converted.unsubLinksReplaced;
        managedIds.push(content.id);
        if (stats.samples.length < (options.samples ?? 5)) {
          stats.samples.push({ contentId: content.id, adId: ad.id, name, active: available, utms: extractUtms(version.html) });
        }
        continue;
      }

      const content = await Content.findByPk(contentId, { transaction });
      const config = content.config ?? {};
      if (config.media?.manual === true) {
        stats.contents.manual++;
        continue;
      }
      managedIds.push(content.id);
      let changed = false;
      if (config.media?.sync?.hash !== hash) {
        const defaultVersion = content.defaultVersionId ? await ContentVersion.findByPk(content.defaultVersionId, { transaction }) : null;
        if (defaultVersion) {
          Object.assign(defaultVersion, version, { contentTemplateId: null, templateVariables: {} });
          await defaultVersion.save({ transaction });
        } else {
          const created = await ContentVersion.create({ name: 'Default Version', contentId: content.id, isDefault: true, contentTemplateId: null, templateVariables: {}, frenchEspsSubject: '', ...version }, { transaction });
          content.defaultVersionId = created.id;
        }
        content.name = name;
        content.category = category;
        content.endDate = distribution.endDate;
        stats.contents.updated++;
        stats.unsubLinksReplaced += converted.unsubLinksReplaced;
        changed = true;
      }
      const nextConfig = { ...config, media: { ...(config.media ?? {}), ...mediaConfig }, filters };
      if (distribution.weight !== undefined) {
        nextConfig.weight = distribution.weight;
      } else {
        delete nextConfig.weight;
      }
      content.config = nextConfig;
      content.changed('config', true);
      let wantActive = available;
      if (wantActive && content.suspended) {
        wantActive = false;
        stats.contents.suspended++;
      }
      if (content.isActive !== wantActive) {
        content.isActive = wantActive;
        if (wantActive) {
          stats.contents.activated++;
        } else {
          stats.contents.deactivated++;
        }
        changed = true;
      }
      if (!changed) {
        stats.contents.unchanged++;
      }
      await content.save({ transaction });
      if (stats.samples.length < (options.samples ?? 5)) {
        stats.samples.push({ contentId: content.id, adId: ad.id, name, active: content.isActive, utms: extractUtms(version.html) });
      }
    }

    // contenus dont la publicité n'existe plus (ou ne cible plus ces produits) : désactivés
    for (const [adId, contentId] of existingByAd) {
      if (seen.has(adId)) {
        continue;
      }
      const content = await Content.findByPk(contentId, { transaction });
      if (!content || content.config?.media?.manual === true || !stats.products.includes(content.config?.media?.product)) {
        continue;
      }
      if (content.isActive) {
        content.isActive = false;
        content.config = { ...content.config, media: { ...content.config.media, sync: { ...(content.config.media.sync ?? {}), syncedAt: now.toISOString(), available: false, reasons: ['missing'] } } };
        content.changed('config', true);
        await content.save({ transaction });
        stats.contents.deactivated++;
      }
      stats.contents.orphaned++;
    }

    if (schedules.length > 0 && managedIds.length > 0) {
      for (const scheduleId of schedules) {
        const [, count] = await sequelize.query(
          `INSERT INTO "ContentSchedule" ("contentId", "scheduleId", "createdAt", "updatedAt")
           SELECT c, $1, now(), now() FROM unnest($2::int[]) AS c
           ON CONFLICT DO NOTHING`,
          { bind: [scheduleId, managedIds], transaction }
        );
        stats.schedules.linked += count ?? 0;
      }
    }

    if (dryRun) {
      await transaction.rollback();
      log.info("Simulation : transaction annulée, rien n'a été écrit");
    } else {
      await transaction.commit();
    }
    return stats;
  } catch (err) {
    await transaction.rollback().catch(() => {});
    throw err;
  } finally {
    if (ownSource) {
      await source.end().catch(() => {});
    }
    if (ownAds && ads) {
      await ads.end().catch(() => {});
    }
  }
};

/** Configuration de l'instance (.env, écrit par deploy/bin/set-media-source.sh). */
const configFromEnv = (env = process.env) => {
  const products = (env.MEDIA_PRODUCTS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const mode = (env.MEDIA_CAMPAIGNS_SCHEDULES ?? '').trim();
  const schedules =
    mode === '' || mode === 'none'
      ? []
      : mode.split(',').map((s) => {
          const id = parseInt(s.trim(), 10);
          if (!Number.isInteger(id) || id <= 0) {
            throw new Error(`MEDIA_CAMPAIGNS_SCHEDULES : identifiant de planification invalide « ${s} » (attendu : none ou id[,id…]).`);
          }
          return id;
        });
  return { sourceUrl: env.MEDIA_DATABASE_URL || null, adsUrl: env.ADS_DATABASE_URL || null, products, schedules };
};

module.exports = { importMediaCampaigns, adAvailability, convertAudience, distributionToV2, extractUtms, configFromEnv, ownAdvertiserIds, findProducts, MEDIA_TZ };
