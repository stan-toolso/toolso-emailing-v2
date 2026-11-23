const Mustache = require('mustache');
const { convert } = require('html-to-text');
const { QueryTypes } = require('sequelize');
const ContentType = require('../storage/models/ContentType');
const { openSource, resolveProducts } = require('./mediaDatabase');
const log = require('../util/log').getLogger('MediaContents');

Mustache.templateCache = undefined;

/**
 * Reprise des contenus d'un produit toolso-media sous forme de `Content` v2 :
 *
 *   article (base media)                 → Content type newsletter + ContentVersion rattachée à un ContentTemplate
 *                                          « Article – <produit> » (créé une fois par produit, modifiable dans l'UI) ;
 *                                          les données de l'article sont dans templateVariables (`{{content.title}}`,
 *                                          `{{content.link}}`, `{{{content.long_resume}}}`, `{{content.image_url}}`, `{{{content.body}}}`…)
 *   DEM (base ads : ad de format `dem`)  → Content type marketing dont le HTML est celui de la publicité, encadré par
 *                                          l'en-tête / pied de page du contenu DEM du produit (settings.header / footer)
 *   DEM (ad de format `dem_template`)    → Content type marketing : gabarit `dem_template` du produit rendu avec la publicité
 *
 * Les deux plateformes rendent les mails avec Mustache et le même vocabulaire (`contact.*`, `unsubLink`, `mirrorLink`,
 * `pixelConsentLink`, `now`, `urlEncode`, `genderFormat`, `dobFormat`, `product.uid`) : les variables propres à media
 * (`ad.*`, `ad_group.*`, `campaign.*`, `product.*`) sont résolues à la conversion et les autres balises sont conservées
 * telles quelles pour être rendues par la v2 à l'envoi (`renderKeeping`). `contact.fields.x` devient `contact.customFields.x`,
 * `{{tsclid}}` et les crochets `[ad …]` (publicités insérées par media) sont retirés.
 *
 * Idempotent : `Content.config.media = { type, id, product }` identifie l'origine ; un contenu déjà repris est ignoré.
 */

const ARTICLE_TEMPLATE_HTML = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{content.title}}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;color:#222;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;">
<tr><td align="center" style="padding:16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;">
<tr><td style="padding:16px 24px;border-bottom:1px solid #e5e5e5;font-size:14px;">
  <a href="{{{content.site_url}}}" style="color:#222;text-decoration:none;font-weight:bold;">{{content.product_name}}</a>
  <span style="float:right;"><a href="{{{mirrorLink}}}" style="color:#888;text-decoration:none;">Voir en ligne</a></span>
</td></tr>
{{#content.image_url}}
<tr><td style="padding:0;"><a href="{{{content.link}}}"><img src="{{{content.image_url}}}" alt="{{content.title}}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;"></a></td></tr>
{{/content.image_url}}
<tr><td style="padding:24px 24px 8px 24px;font-size:24px;line-height:30px;font-weight:bold;"><a href="{{{content.link}}}" style="color:#222;text-decoration:none;">{{content.title}}</a></td></tr>
<tr><td style="padding:0 24px 16px 24px;font-size:16px;line-height:24px;">{{{content.long_resume}}}</td></tr>
<tr><td style="padding:0 24px 24px 24px;">
  <a href="{{{content.cta_url}}}" style="display:inline-block;background:#11770F;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:4px;">Lire l'article</a>
</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid #e5e5e5;font-size:12px;line-height:18px;color:#888;">
  Vous recevez cet e-mail car vous êtes inscrit à {{content.product_name}}.
  <a href="{{{unsubLink}}}" style="color:#888;">Se désabonner</a>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
`;

const PASSTHROUGH_ROOTS_V2 = ['contact', 'unsubLink', 'unsubscribe', 'mirrorLink', 'mirror', 'pixelConsentLink', 'settingsLink', 'now', 'urlEncode', 'genderFormat', 'dobFormat', 'template_part', 'uuid', 'email'];

const collectTags = (tokens, out = { names: [], unescaped: new Set(), inverted: new Set() }) => {
  for (const token of tokens) {
    const [type, name] = token;
    if (type === 'name' || type === '&' || type === '#' || type === '^') {
      out.names.push(name);
      if (type === '&') {
        out.unescaped.add(name);
      }
      if (type === '^') {
        out.inverted.add(name);
      }
    }
    if (token[4]) {
      collectTags(token[4], out);
    }
  }
  return out;
};

/**
 * Rend `template` avec Mustache en ne résolvant que les variables dont la racine est dans `view` ; toute autre balise
 * (`{{contact.firstname}}`, `{{#now}}…{{/now}}`, `{{unsubLink}}`…) est réécrite à l'identique pour être rendue plus tard
 * par la v2. Les sections sur ces variables sont conservées (leur intérieur est lui-même converti) ; les sections inversées
 * (`{{^x}}`) sur une variable conservée ne peuvent pas l'être et sont rendues vides.
 * @returns {{ html: string, kept: string[], droppedInverted: string[] }}
 */
const renderKeeping = (template, view) => {
  if (!template) {
    return { html: '', kept: [], droppedInverted: [] };
  }
  const tags = collectTags(Mustache.parse(template));
  const full = { ...view };
  const kept = new Set();
  const droppedInverted = new Set();
  // mustache.js appelle la valeur trouvée (sans argument) à la recherche, puis, si c'est encore une fonction, l'appelle en
  // lambda de section avec (texte, render) ; pour une balise simple il convertit la valeur en chaîne (toString).
  const passthrough = (path) => {
    const tag = tags.unescaped.has(path) ? `{{{${path}}}}` : `{{${path}}}`;
    const lambda = (text) => `{{#${path}}}${renderKeeping(text, view).html}{{/${path}}}`;
    lambda.toString = () => tag;
    return () => lambda;
  };
  for (const name of tags.names) {
    if (name === '.') {
      continue;
    }
    const segments = name.split('.');
    if (segments[0] in view) {
      continue;
    }
    kept.add(name);
    if (tags.inverted.has(name)) {
      droppedInverted.add(name);
    }
    let node = full;
    let path = '';
    for (const segment of segments) {
      path = path ? `${path}.${segment}` : segment;
      if (!(segment in node)) {
        node[segment] = passthrough(path);
      }
      node = node[segment];
    }
  }
  return { html: Mustache.render(template, full), kept: [...kept], droppedInverted: [...droppedInverted] };
};

/** Slug par défaut de la page de désabonnement media (`<site>/desinscription`), en plus des pages `unsub` du produit. */
const DEFAULT_UNSUB_SLUGS = ['desinscription'];

const URL_PARTS = /^(?:https?:)?\/\/([^/?#:\s]+)(?::\d+)?([^?#\s]*)/i;

/** Hôte (minuscules) et chemin (sans / final) d'une URL absolue, ou null. */
const urlParts = (url) => {
  const m = URL_PARTS.exec(String(url ?? '').trim());
  if (!m) {
    return null;
  }
  return { host: m[1].toLowerCase(), path: m[2].replace(/\/+$/, '') };
};

const stripWww = (host) => host.replace(/^www\./, '');

/**
 * Repères des liens de désabonnement d'un produit media (qui désabonnent dans media, pas dans la v2) :
 *   - `settings.emailingUnsubUrl` (page de désabonnement media, ex. `https://news.<site>/desinscription`, à laquelle media
 *     ajoute `?kid=…&el=…`) et tout ce qui commence par elle ;
 *   - le domaine `unsubscribe.<domaine du produit>` (page de désabonnement du site, ex. `?email={{contact.email}}`) ;
 *   - `<domaine du produit ou sous-domaine>/<slug>` pour les pages `unsub` du produit (défaut `desinscription`).
 * Domaines du produit : `product.main_domain`, hôte de `siteUrl`, de `emailingRedirectionLink` et de `emailingUnsubUrl`
 * (sans `www.`, et pour les deux derniers leur domaine parent : `news.<site>` → `<site>`).
 */
const mediaUnsubMatchers = ({ unsubUrl, siteUrl, redirection, mainDomain, slugs = [] } = {}) => {
  const domains = new Set();
  const addDomain = (host, parent = false) => {
    if (!host) {
      return;
    }
    host = stripWww(host.toLowerCase());
    domains.add(host);
    const labels = host.split('.');
    if (parent && labels.length > 2) {
      domains.add(labels.slice(1).join('.'));
    }
  };
  addDomain(mainDomain ? urlParts(`//${mainDomain}`)?.host : null);
  addDomain(urlParts(siteUrl)?.host);
  addDomain(urlParts(redirection)?.host, true);
  addDomain(urlParts(unsubUrl)?.host, true);
  const unsub = urlParts(unsubUrl);
  return {
    prefixes: unsub ? [`${unsub.host}${unsub.path}`] : [],
    domains: [...domains],
    slugs: [...new Set([...DEFAULT_UNSUB_SLUGS, ...slugs.filter(Boolean).map((s) => String(s).toLowerCase())])]
  };
};

/** Vrai si `url` est un lien de désabonnement media d'après `matchers` (`mediaUnsubMatchers`). */
const isMediaUnsubUrl = (url, matchers) => {
  if (!matchers) {
    return false;
  }
  const parts = urlParts(url);
  if (!parts) {
    return false;
  }
  const { host, path } = parts;
  const full = `${host}${path}`;
  if (matchers.prefixes.some((p) => full === p || full.startsWith(`${p}/`) || stripWww(host) + path === stripWww(p))) {
    return true;
  }
  const inDomain = (h, d) => h === d || h.endsWith(`.${d}`);
  if (host.startsWith('unsubscribe.') && matchers.domains.some((d) => inDomain(host.slice('unsubscribe.'.length), d))) {
    return true;
  }
  const firstSegment = decodeURIComponent(path.split('/')[1] ?? '').toLowerCase();
  return !!firstSegment && matchers.slugs.includes(firstSegment) && matchers.domains.some((d) => inDomain(stripWww(host), d));
};

/**
 * Remplace par `{{{unsubLink}}}` (lien de désabonnement v2) le href des liens de désabonnement media : liens marqués
 * `toolso:unsub` (media enregistre le désabonnement au clic puis redirige) et URL reconnues par `matchers`. Les attributs
 * sont conservés (`toolso:unsub` garde en v2 le même sens : le clic désabonne). Les balises Mustache (`{{…}}`) en href ne
 * sont pas touchées. @returns {{ html: string, replaced: number }}
 */
const replaceMediaUnsubLinks = (html, matchers = null) => {
  let replaced = 0;
  html = String(html ?? '').replace(/<a\b[^>]*>/gi, (tag) => {
    const href = /(\bhref\s*=\s*)(["'])(.*?)\2/is.exec(tag);
    if (!href || /^\s*\{\{/.test(href[3])) {
      return tag;
    }
    const marked = /\stoolso:unsub(?=[\s=>/])/i.test(tag);
    if (!marked && !isMediaUnsubUrl(href[3], matchers)) {
      return tag;
    }
    replaced++;
    return tag.replace(href[0], `${href[1]}${href[2]}{{{unsubLink}}}${href[2]}`);
  });
  return { html, replaced };
};

/**
 * Adapte les balises media au vocabulaire v2 et retire ce qui n'a pas d'équivalent ; renvoie aussi ce qui a été retiré.
 * Les liens de désabonnement media deviennent `{{{unsubLink}}}` (`replaceMediaUnsubLinks`, repères `options.unsub`).
 */
const adaptToV2 = (html, options = {}) => {
  const removed = { adShortcodes: 0, tsclid: 0, fieldsRenamed: 0, unsubLinks: 0 };
  html = html.replace(/\[ad[^\]]*\]/gi, () => {
    removed.adShortcodes++;
    return '';
  });
  html = html.replace(/__tsclid__/g, () => {
    removed.tsclid++;
    return '';
  });
  html = html.replace(/\{\{([#^/&]?)\s*contact\.fields\./g, (m, prefix) => {
    removed.fieldsRenamed++;
    return `{{${prefix}contact.customFields.`;
  });
  const unsub = replaceMediaUnsubLinks(html, options.unsub ?? null);
  html = unsub.html;
  removed.unsubLinks = unsub.replaced;
  return { html, removed };
};

const insertHeaderFooter = (html, header, footer) => {
  if (header) {
    html = /<body[^>]*>/i.test(html) ? html.replace(/<body[^>]*>/i, (m) => `${m}\n${header}`) : `${header}\n${html}`;
  }
  if (footer) {
    html = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${footer}\n</body>`) : `${html}\n${footer}`;
  }
  return html;
};

const resume = (html, size, elipsis = '[..]') => {
  if (!html) {
    return '';
  }
  let text = convert(html, { wordwrap: false, selectors: [{ selector: 'a', options: { ignoreHref: true } }, { selector: 'img', format: 'skip' }] }).replace(/\s+/g, ' ').trim();
  if (text.length > size && text.indexOf(' ', size) > 0) {
    text = text.substring(0, text.indexOf(' ', size) + 1) + elipsis;
  }
  return text;
};

const isOn = (value) => value === true || value === 'true' || value === 1 || value === '1';

const toIso = (value) => {
  if (!value) {
    return null;
  }
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? null : d.toISOString();
};

/** Paramètres media d'un produit (valeur du produit, sinon valeur globale). */
const productSettings = async (source, productId, names) => {
  const { rows } = await source.query('SELECT name, value, product_id FROM settings WHERE name = ANY($1::text[]) AND (product_id = $2 OR product_id IS NULL) ORDER BY product_id NULLS FIRST', [names, productId]);
  const settings = {};
  for (const row of rows) {
    settings[row.name] = row.value;
  }
  return settings;
};

/** Version active du contenu media d'un type donné pour un produit (body résolu via email_template si besoin). */
const activeContentVersion = async (source, productId, type) => {
  const { rows } = await source.query(
    `SELECT v.id, v.body, v.settings, v.subject, v.preview_text, v.sender_name, t.body AS template_body
       FROM email_content c
       JOIN email_content_version v ON v.email_content_id = c.id
       LEFT JOIN email_template t ON t.id = v.template_id
      WHERE c.product_id = $1 AND c.type = $2 AND c.archived IS NOT TRUE AND c.is_active IS NOT FALSE
        AND v.archived IS NOT TRUE AND v.is_active IS NOT FALSE
      ORDER BY v.id DESC LIMIT 1`,
    [productId, type]
  );
  if (rows.length === 0) {
    return null;
  }
  return { ...rows[0], body: rows[0].template_body ?? rows[0].body };
};

const existingMediaContents = async (sequelize, transaction) => {
  const rows = await sequelize.query(`SELECT id AS "contentId", config->'media'->>'type' AS type, config->'media'->>'id' AS id FROM "Content" WHERE (config->'media') IS NOT NULL ORDER BY id`, {
    type: QueryTypes.SELECT,
    transaction
  });
  return new Map(rows.map((r) => [`${r.type}:${r.id}`, r.contentId]));
};

const newStats = () => ({
  products: [],
  templates: { created: 0, reused: 0 },
  articles: { read: 0, existing: 0, created: 0, withoutImage: 0 },
  dems: { read: 0, otherProduct: 0, disabled: 0, existing: 0, created: 0, updated: 0, manual: 0, noTemplate: 0, adShortcodesRemoved: 0, unsubLinksReplaced: 0, keptTags: {}, droppedInverted: [] }
});

/**
 * Publicités DEM de la base ads, avec leur groupe et leur campagne complets (tels que media les passe aux gabarits), sans
 * les colonnes de statistiques (volumineuses). Avec `productIds`, seulement celles qui peuvent cibler ces produits
 * (`ad_group.support_settings.productIds` vide ou contenant l'un d'eux) : la base ads est commune à tous les clients.
 */
const loadDemAds = async (ads, productIds = null) => {
  const params = [];
  let productFilter = '';
  if (productIds && productIds.length > 0) {
    params.push(productIds.map(String));
    productFilter = `AND (coalesce(jsonb_array_length(CASE WHEN jsonb_typeof(g.support_settings->'productIds') = 'array' THEN g.support_settings->'productIds' END), 0) = 0
              OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(g.support_settings->'productIds') pid WHERE pid = ANY($1::text[])))`;
  }
  const { rows } = await ads.query(
    `SELECT a.id, a.name, a.status, a.enabled, a.advertiser_id, a.ad_group_id, a.campaign_id, a.format, a.content, a.destination, a.public, a.support_settings,
            to_jsonb(g) - 'stats' - 'last_stats' - 'demographic_stats' AS ad_group,
            to_jsonb(c) - 'stats' - 'last_stats' - 'demographic_stats' AS campaign,
            adv.name AS advertiser_name, p.name AS partner_name, p.ts_click_field, p.ts_click_value
       FROM ad a
       JOIN ad_group g ON g.id = a.ad_group_id
       JOIN campaign c ON c.id = a.campaign_id
       LEFT JOIN advertiser adv ON adv.id = a.advertiser_id
       LEFT JOIN partner p ON p.id = g.partner_id
      WHERE a.format IN ('dem', 'dem_template') ${productFilter} ORDER BY a.id`,
    params
  );
  return rows;
};

/** Filtre de support de media (bestAd) : `ad_group.support_settings.productIds` vide ou contenant le produit. */
const adTargetsProduct = (ad, productId) => {
  const productIds = (ad.ad_group?.support_settings?.productIds ?? []).map((id) => parseInt(id, 10));
  return productIds.length === 0 || productIds.includes(productId);
};

/** Slugs des pages de désabonnement publiées du produit (table `page`, gabarit `unsub`) ; [] si la table n'existe pas. */
const unsubPageSlugs = async (source, productId) => {
  try {
    const { rows } = await source.query(`SELECT slug FROM page WHERE product_id = $1 AND template = 'unsub' AND slug IS NOT NULL`, [productId]);
    return rows.map((r) => r.slug);
  } catch (err) {
    log.warn(`Pages de désabonnement media non lues (${err.message})`);
    return [];
  }
};

/** Ce qui ne dépend que du produit pour convertir ses DEM : en-tête / pied de page DEM, gabarit dem_template, liens. */
const demProductContext = async (source, product, known = {}) => {
  let { siteUrl, redirection } = known;
  const settings = await productSettings(source, product.id, ['siteUrl', 'emailingRedirectionLink', 'emailingUnsubUrl']);
  if (siteUrl === undefined || redirection === undefined) {
    siteUrl = (settings.siteUrl ?? '').replace(/\/$/, '');
    redirection = (settings.emailingRedirectionLink ?? siteUrl).replace(/\/$/, '');
  }
  const demVersion = await activeContentVersion(source, product.id, 'dem');
  const demTemplateVersion = await activeContentVersion(source, product.id, 'dem_template');
  return {
    product,
    productView: { id: product.id, uid: product.uid, name: product.name, main_domain: product.main_domain },
    header: demVersion?.settings?.header ?? null,
    footer: demVersion?.settings?.footer ?? null,
    demTemplateVersion,
    redirection,
    unsub: mediaUnsubMatchers({ unsubUrl: settings.emailingUnsubUrl, siteUrl, redirection, mainDomain: product.main_domain, slugs: await unsubPageSlugs(source, product.id) })
  };
};

const TSCLID_PATTERN = /\{\{\{?\s*tsclid\s*\}?\}\}|__tsclid__/;

/**
 * Ajoute (ou remplace) un paramètre dans une URL, comme `addParameterToUrl` de media (valeur insérée telle quelle), sans
 * réencoder le reste de l'URL : elle contient encore des balises Mustache rendues par la v2 à l'envoi.
 */
const addParameterToUrl = (url, key, value) => {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const existing = new RegExp(`([?&])${escaped}=[^&#]*`);
  if (url.indexOf('?') >= 0) {
    return existing.test(url) ? url.replace(existing, (m, sep) => `${sep}${key}=${value}`) : `${url}&${key}=${value}`;
  }
  return `${url}?${key}=${value}`;
};

/** Applique `fn` à chaque href de `html` (media : `HtmlReplace.replaceAllHref`), sauf `#`, `mailto:` et les balises v2 (`{{{unsubLink}}}`…). */
const replaceHrefs = (html, fn) =>
  html.replace(/(\bhref\s*=\s*)(["'])(.*?)\2/gis, (m, attr, quote, url) => {
    const trimmed = url.trim();
    if (!trimmed || trimmed === '#' || /^mailto:/i.test(trimmed) || /^\{\{/.test(trimmed)) {
      return m;
    }
    return `${attr}${quote}${fn(url)}${quote}`;
  });

/**
 * Convertit une publicité DEM (format `dem` ou `dem_template`) en HTML v2, comme `buildEmailContent.js` de media la compose
 * à l'envoi : variables `ad.*`, `ad_group.*`, `campaign.*`, `product.*` résolues (les utm des liens, ex.
 * `utm_campaign={{campaign.id}}-{{ad_group.id}}-{{ad.id}}&utm_source={{product.uid}}`, deviennent littéraux), balises
 * de contact conservées pour la v2, paramètre de clic du partenaire (`ts_click_field`) ajouté à chaque lien.
 * Le paramètre de clic qui dépend de l'identifiant de clic media (`tsclid`, généré à la redirection media) n'a pas
 * d'équivalent v2 : il n'est pas ajouté (compté dans `tsClick.skipped`).
 * Les liens de désabonnement media (pied de page DEM du produit, publicité) deviennent `{{{unsubLink}}}` (`adaptToV2`).
 * @returns {null | { html, subject, previewText, senderName, kept, droppedInverted, adShortcodesRemoved, unsubLinksReplaced, tsClick }}
 *          null : DEM `dem_template` sans gabarit dans le produit.
 */
const convertDem = (ad, ctx) => {
  const content = ad.content && typeof ad.content === 'object' ? ad.content : {};
  const adGroup = { ...(ad.ad_group ?? {}), id: ad.ad_group_id, customs: ad.ad_group?.customs ?? {} };
  const campaign = { ...(ad.campaign ?? {}), id: ad.campaign_id };
  const adRow = { ...ad };
  delete adRow.ad_group;
  delete adRow.campaign;
  const adView = { ...adRow, content, ad_group: adGroup, campaign };
  const baseView = { ad: adView, ad_group: adGroup, campaign, product: ctx.productView, database: ctx.productView, content: { id: null }, tsclid: '' };
  let html;
  let subject;
  let previewText;
  let senderName = '';
  let rendered;
  let view = baseView;
  if (ad.format === 'dem') {
    rendered = renderKeeping(content.html ?? '', baseView);
    html = rendered.html;
    subject = content.subject ?? '';
    senderName = content.sender_name ?? '';
    previewText = content.preview_text ?? '';
  } else {
    if (!ctx.demTemplateVersion) {
      return null;
    }
    const destination = ad.destination && typeof ad.destination === 'object' ? ad.destination : {};
    view = { ...baseView, ad: { ...adView, ...content } };
    if (destination.url) {
      view.ad.link = renderKeeping(destination.url, view).html;
    }
    if (content.image && content.image.url) {
      const url = content.image.url.startsWith('/') ? `${ctx.redirection}${content.image.url}` : content.image.url;
      view.ad.image = { ...content.image, url, src: url };
    }
    rendered = renderKeeping(ctx.demTemplateVersion.body ?? '', view);
    html = rendered.html;
    subject = renderKeeping(content.subject ?? content.title ?? ctx.demTemplateVersion.subject ?? '', view).html;
    previewText = renderKeeping(content.preview_text ?? content.title ?? ctx.demTemplateVersion.preview_text ?? '', view).html;
    senderName = ctx.demTemplateVersion.sender_name ?? '';
  }
  // paramètre de clic du partenaire, ajouté par media à tous les liens de la publicité
  const tsClick = { applied: 0, skipped: 0 };
  if (ad.ts_click_field && ad.ts_click_value) {
    if (TSCLID_PATTERN.test(ad.ts_click_value)) {
      tsClick.skipped = 1;
    } else {
      const value = renderKeeping(ad.ts_click_value, view).html;
      html = replaceHrefs(html, (url) => {
        tsClick.applied++;
        return addParameterToUrl(url, ad.ts_click_field, value);
      });
    }
  }
  if (ad.format === 'dem') {
    html = insertHeaderFooter(html, ctx.header, ctx.footer);
  }
  const adapted = adaptToV2(html, { unsub: ctx.unsub });
  return { html: adapted.html, subject, previewText, senderName, kept: rendered.kept, droppedInverted: rendered.droppedInverted, adShortcodesRemoved: adapted.removed.adShortcodes, unsubLinksReplaced: adapted.removed.unsubLinks, tsClick };
};

const demContentName = (ad) => `${ad.campaign?.name ?? 'DEM'} – ${ad.name ?? ad.id}`.slice(0, 255);

const demMediaConfig = (ad, product) => ({
  type: 'dem',
  id: ad.id,
  product: product.uid,
  format: ad.format,
  campaignId: ad.campaign_id,
  adGroupId: ad.ad_group_id,
  partner: ad.partner_name ?? null,
  tsClick: ad.ts_click_field ? { field: ad.ts_click_field, value: ad.ts_click_value } : null
});

/**
 * @param {object} options
 * @param {import('sequelize').Sequelize} options.sequelize
 * @param {string} [options.sourceUrl] base media (ou `source`)
 * @param {import('pg').Client} [options.source]
 * @param {string} [options.adsUrl] base ads (ou `ads`) ; sans elle, les DEM ne sont pas reprises
 * @param {import('pg').Client} [options.ads]
 * @param {string[]} [options.products]
 * @param {boolean} [options.articles] reprendre les articles (défaut true)
 * @param {boolean} [options.dems] reprendre les DEM (défaut : si une base ads est fournie)
 * @param {boolean} [options.allArticles] aussi les articles non publiés / exclus de l'emailing
 * @param {number} [options.sinceDays] articles publiés depuis N jours (défaut : tous)
 * @param {boolean} [options.includeDisabled] aussi les publicités / campagnes désactivées ou archivées
 * @param {boolean} [options.updateDems] DEM déjà reprises : HTML, objet, préentête et expéditeur de la version par défaut
 *        recalculés (ex. après une correction de la conversion) ; un contenu `config.media.manual` n'est pas touché
 * @param {boolean} [options.dryRun]
 */
const migrateContentsFromMedia = async (options) => {
  const { sequelize, dryRun = false, allArticles = false, includeDisabled = false, sinceDays = 0, updateDems = false } = options;
  const doArticles = options.articles !== false;
  const { Content, ContentVersion, ContentTemplate } = sequelize.models;
  const stats = newStats();
  stats.dryRun = dryRun;
  const ownSource = !options.source;
  const ownAds = !options.ads && !!options.adsUrl;
  const source = options.source ?? (await openSource(options.sourceUrl));
  const ads = options.ads ?? (options.adsUrl ? await openSource(options.adsUrl) : null);
  const doDems = options.dems ?? !!ads;
  if (doDems && !ads) {
    throw new Error('Reprise des DEM demandée sans base ads (ADS_DATABASE_URL / --ads-url).');
  }
  const transaction = await sequelize.transaction();
  try {
    const products = await resolveProducts(source, options.products);
    stats.products = products.map((p) => p.uid);
    const existing = await existingMediaContents(sequelize, transaction);

    const createContent = async ({ name, type, category, media, version }) => {
      const content = await Content.create({ name: (name || `media ${media.type} ${media.id}`).slice(0, 255), type, isActive: false, category: category ? String(category).slice(0, 255) : null, config: { media } }, { transaction });
      const contentVersion = await ContentVersion.create(
        {
          name: 'Default Version',
          contentId: content.id,
          isDefault: true,
          contentTemplateId: version.contentTemplateId ?? null,
          templateVariables: version.templateVariables ?? {},
          html: version.html ?? '',
          subject: (version.subject ?? '').slice(0, 255),
          frenchEspsSubject: '',
          previewText: (version.previewText ?? '').slice(0, 255),
          senderName: (version.senderName ?? '').slice(0, 255)
        },
        { transaction }
      );
      content.defaultVersionId = contentVersion.id;
      await content.save({ transaction });
      existing.set(`${media.type}:${media.id}`, content.id);
      return content;
    };

    for (const product of products) {
      const settings = await productSettings(source, product.id, ['siteUrl', 'imgBaseUrl', 'articleLinkCustomField', 'emailingRedirectionLink', 'siteName']);
      const siteUrl = (settings.siteUrl ?? '').replace(/\/$/, '');
      const redirection = (settings.emailingRedirectionLink ?? siteUrl).replace(/\/$/, '');

      // ---------- articles ----------
      if (doArticles) {
        const templateName = `Article – ${product.name ?? product.uid}`;
        let template = await ContentTemplate.findOne({ where: { name: templateName }, transaction });
        if (template) {
          stats.templates.reused++;
        } else {
          template = await ContentTemplate.create({ name: templateName, html: ARTICLE_TEMPLATE_HTML, subject: '', frenchEspsSubject: '', previewText: '{{content.preview_text}}', senderName: '' }, { transaction });
          stats.templates.created++;
        }
        const conditions = ['a.product_id = $1'];
        const params = [product.id];
        if (!allArticles) {
          conditions.push(`a.status = 'published'`, `(a.distribution_settings->>'emailing_enabled') IS DISTINCT FROM 'false'`);
        }
        if (sinceDays > 0) {
          params.push(sinceDays);
          conditions.push(`coalesce(a.published_at, a.created_at) >= now() - ($${params.length} || ' days')::interval`);
        }
        const { rows } = await source.query(
          `SELECT a.*, i.slug AS image_slug,
                  (SELECT string_agg(c.name, '|' ORDER BY ca.created_at, c.id) FROM category_article ca JOIN category c ON c.id = ca.category_id WHERE ca.article_id = a.id) AS category_names
             FROM article a LEFT JOIN image i ON i.id = a.featured_image_id
            WHERE ${conditions.join(' AND ')} ORDER BY a.id`,
          params
        );
        stats.articles.read += rows.length;
        for (const article of rows) {
          if (existing.has(`article:${article.id}`)) {
            stats.articles.existing++;
            continue;
          }
          const customs = article.customs && typeof article.customs === 'object' ? article.customs : {};
          const link = article.link || (settings.articleLinkCustomField && customs[settings.articleLinkCustomField]) || article.url || (siteUrl ? `${siteUrl}/${article.slug}` : '');
          const imageBase = `${(settings.imgBaseUrl ?? siteUrl).replace(/\/$/, '')}/imgs`;
          let imageUrl = null;
          let imageW400 = null;
          if (article.image_slug) {
            imageUrl = `${imageBase}/max/${article.image_slug}.webp`;
            imageW400 = `${imageBase}/400x400/${article.image_slug}.webp`;
          } else if (article.featured_image && typeof article.featured_image === 'object' && article.featured_image.url) {
            imageUrl = article.featured_image.url;
            imageW400 = article.featured_image.url;
          } else {
            stats.articles.withoutImage++;
          }
          const categories = article.category_names ? article.category_names.split('|') : [];
          const shortResume = resume(article.description || article.content, 100);
          const longResume = resume(article.description || article.content, 200);
          const subject = article.email_subject || article.title || '';
          const templateVariables = {
            title: article.title ?? '',
            subject,
            preview_text: article.short_description || shortResume,
            link,
            cta_url: article.cta_url || link,
            slug: article.slug,
            published_at: toIso(article.published_at),
            short_resume: shortResume,
            long_resume: longResume,
            description: article.description ?? '',
            short_description: article.short_description ?? '',
            body: article.content ?? '',
            image_url: imageUrl,
            image_w400: imageW400,
            categories,
            category: categories[0] ?? null,
            customs,
            site_url: siteUrl,
            product_name: settings.siteName || product.name || product.uid,
            media: { product: product.uid, article_id: article.id }
          };
          await createContent({
            name: article.title,
            type: ContentType.newsletter,
            category: categories[0] ?? null,
            media: { type: 'article', id: article.id, product: product.uid, publishedAt: toIso(article.published_at) },
            version: { contentTemplateId: template.id, templateVariables, subject, previewText: templateVariables.preview_text }
          });
          stats.articles.created++;
        }
      }

      // ---------- DEM (base ads) ----------
      if (doDems) {
        const ctx = await demProductContext(source, product, { siteUrl, redirection });
        const rows = await loadDemAds(ads, [product.id]);
        stats.dems.read += rows.length;
        for (const ad of rows) {
          if (!adTargetsProduct(ad, product.id)) {
            stats.dems.otherProduct++;
            continue;
          }
          if (!includeDisabled && (!isOn(ad.enabled) || !isOn(ad.ad_group?.enabled) || !isOn(ad.campaign?.enabled) || ad.campaign?.archived === true)) {
            stats.dems.disabled++;
            continue;
          }
          const existingId = existing.get(`dem:${ad.id}`);
          if (existingId && !updateDems) {
            stats.dems.existing++;
            continue;
          }
          const converted = convertDem(ad, ctx);
          if (!converted) {
            stats.dems.noTemplate++;
            continue;
          }
          if (existingId) {
            stats.dems.existing++;
            const content = await Content.findByPk(existingId, { transaction });
            if (content?.config?.media?.manual === true) {
              stats.dems.manual++;
              continue;
            }
            const version = content?.defaultVersionId ? await ContentVersion.findByPk(content.defaultVersionId, { transaction }) : null;
            if (!version) {
              continue;
            }
            const next = { html: converted.html, subject: (converted.subject ?? '').slice(0, 255), previewText: (converted.previewText ?? '').slice(0, 255), senderName: (converted.senderName ?? '').slice(0, 255) };
            if (Object.keys(next).some((k) => (version[k] ?? '') !== next[k])) {
              Object.assign(version, next);
              await version.save({ transaction });
              stats.dems.updated++;
              stats.dems.unsubLinksReplaced += converted.unsubLinksReplaced;
            }
            continue;
          }
          stats.dems.adShortcodesRemoved += converted.adShortcodesRemoved;
          stats.dems.unsubLinksReplaced += converted.unsubLinksReplaced;
          for (const tag of converted.kept) {
            stats.dems.keptTags[tag] = (stats.dems.keptTags[tag] ?? 0) + 1;
          }
          for (const tag of converted.droppedInverted) {
            if (!stats.dems.droppedInverted.includes(tag)) {
              stats.dems.droppedInverted.push(tag);
            }
          }
          await createContent({
            name: demContentName(ad),
            type: ContentType.marketing,
            category: ad.advertiser_name ?? null,
            media: demMediaConfig(ad, product),
            version: { html: converted.html, subject: converted.subject, previewText: converted.previewText, senderName: converted.senderName }
          });
          stats.dems.created++;
        }
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

module.exports = {
  migrateContentsFromMedia,
  renderKeeping,
  adaptToV2,
  mediaUnsubMatchers,
  isMediaUnsubUrl,
  replaceMediaUnsubLinks,
  insertHeaderFooter,
  resume,
  loadDemAds,
  adTargetsProduct,
  demProductContext,
  convertDem,
  addParameterToUrl,
  replaceHrefs,
  demContentName,
  demMediaConfig,
  productSettings,
  isOn,
  ARTICLE_TEMPLATE_HTML,
  PASSTHROUGH_ROOTS_V2
};
