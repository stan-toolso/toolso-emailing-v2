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

/** Adapte les balises media au vocabulaire v2 et retire ce qui n'a pas d'équivalent ; renvoie aussi ce qui a été retiré. */
const adaptToV2 = (html) => {
  const removed = { adShortcodes: 0, tsclid: 0, fieldsRenamed: 0 };
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
  const rows = await sequelize.query(`SELECT config->'media'->>'type' AS type, config->'media'->>'id' AS id FROM "Content" WHERE (config->'media') IS NOT NULL`, { type: QueryTypes.SELECT, transaction });
  return new Set(rows.map((r) => `${r.type}:${r.id}`));
};

const newStats = () => ({
  products: [],
  templates: { created: 0, reused: 0 },
  articles: { read: 0, existing: 0, created: 0, withoutImage: 0 },
  dems: { read: 0, otherProduct: 0, disabled: 0, existing: 0, created: 0, noTemplate: 0, adShortcodesRemoved: 0, keptTags: {}, droppedInverted: [] }
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
 * @param {boolean} [options.dryRun]
 */
const migrateContentsFromMedia = async (options) => {
  const { sequelize, dryRun = false, allArticles = false, includeDisabled = false, sinceDays = 0 } = options;
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
      existing.add(`${media.type}:${media.id}`);
      return content;
    };

    for (const product of products) {
      const settings = await productSettings(source, product.id, ['siteUrl', 'imgBaseUrl', 'articleLinkCustomField', 'emailingRedirectionLink', 'siteName']);
      const siteUrl = (settings.siteUrl ?? '').replace(/\/$/, '');
      const redirection = (settings.emailingRedirectionLink ?? siteUrl).replace(/\/$/, '');
      const productView = { id: product.id, uid: product.uid, name: product.name, main_domain: product.main_domain };

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
        const demVersion = await activeContentVersion(source, product.id, 'dem');
        const demTemplateVersion = await activeContentVersion(source, product.id, 'dem_template');
        const header = demVersion?.settings?.header ?? null;
        const footer = demVersion?.settings?.footer ?? null;
        const { rows } = await ads.query(
          `SELECT a.*, g.name AS ad_group_name, g.enabled AS ad_group_enabled, g.support_settings AS ad_group_support_settings, g.customs AS ad_group_customs,
                  c.name AS campaign_name, c.enabled AS campaign_enabled, c.archived AS campaign_archived, c.public AS campaign_public,
                  adv.name AS advertiser_name, p.name AS partner_name, p.ts_click_field, p.ts_click_value
             FROM ad a
             JOIN ad_group g ON g.id = a.ad_group_id
             JOIN campaign c ON c.id = a.campaign_id
             LEFT JOIN advertiser adv ON adv.id = a.advertiser_id
             LEFT JOIN partner p ON p.id = g.partner_id
            WHERE a.format IN ('dem', 'dem_template') ORDER BY a.id`
        );
        stats.dems.read += rows.length;
        for (const ad of rows) {
          const productIds = (ad.ad_group_support_settings?.productIds ?? []).map((id) => parseInt(id, 10));
          if (productIds.length > 0 && !productIds.includes(product.id)) {
            stats.dems.otherProduct++;
            continue;
          }
          if (!includeDisabled && (!isOn(ad.enabled) || !isOn(ad.ad_group_enabled) || !isOn(ad.campaign_enabled) || ad.campaign_archived === true)) {
            stats.dems.disabled++;
            continue;
          }
          if (existing.has(`dem:${ad.id}`)) {
            stats.dems.existing++;
            continue;
          }
          const content = ad.content && typeof ad.content === 'object' ? ad.content : {};
          const adGroup = { id: ad.ad_group_id, name: ad.ad_group_name, customs: ad.ad_group_customs ?? {} };
          const campaign = { id: ad.campaign_id, name: ad.campaign_name, public: ad.campaign_public };
          let html;
          let subject;
          let previewText;
          let senderName = '';
          const adView = { ...ad, content, ad_group: adGroup, campaign };
          const baseView = { ad: adView, ad_group: adGroup, campaign, product: productView, database: productView, content: { id: null }, tsclid: '' };
          let rendered;
          if (ad.format === 'dem') {
            rendered = renderKeeping(content.html ?? '', baseView);
            html = insertHeaderFooter(rendered.html, header, footer);
            subject = content.subject ?? '';
            senderName = content.sender_name ?? '';
            previewText = content.preview_text ?? '';
          } else {
            if (!demTemplateVersion) {
              stats.dems.noTemplate++;
              continue;
            }
            const destination = ad.destination && typeof ad.destination === 'object' ? ad.destination : {};
            const view = { ...baseView, ad: { ...adView, ...content } };
            if (destination.url) {
              view.ad.link = renderKeeping(destination.url, view).html;
            }
            if (content.image && content.image.url) {
              const url = content.image.url.startsWith('/') ? `${redirection}${content.image.url}` : content.image.url;
              view.ad.image = { ...content.image, url, src: url };
            }
            rendered = renderKeeping(demTemplateVersion.body ?? '', view);
            html = rendered.html;
            subject = renderKeeping(content.subject ?? content.title ?? demTemplateVersion.subject ?? '', view).html;
            previewText = renderKeeping(content.preview_text ?? content.title ?? demTemplateVersion.preview_text ?? '', view).html;
            senderName = demTemplateVersion.sender_name ?? '';
          }
          const adapted = adaptToV2(html);
          stats.dems.adShortcodesRemoved += adapted.removed.adShortcodes;
          for (const tag of rendered.kept) {
            stats.dems.keptTags[tag] = (stats.dems.keptTags[tag] ?? 0) + 1;
          }
          for (const tag of rendered.droppedInverted) {
            if (!stats.dems.droppedInverted.includes(tag)) {
              stats.dems.droppedInverted.push(tag);
            }
          }
          await createContent({
            name: `${ad.campaign_name ?? 'DEM'} – ${ad.name ?? ad.id}`,
            type: ContentType.marketing,
            category: ad.advertiser_name ?? null,
            media: { type: 'dem', id: ad.id, product: product.uid, format: ad.format, campaignId: ad.campaign_id, adGroupId: ad.ad_group_id, partner: ad.partner_name ?? null, tsClick: ad.ts_click_field ? { field: ad.ts_click_field, value: ad.ts_click_value } : null },
            version: { html: adapted.html, subject, previewText, senderName }
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

module.exports = { migrateContentsFromMedia, renderKeeping, adaptToV2, insertHeaderFooter, resume, ARTICLE_TEMPLATE_HTML, PASSTHROUGH_ROOTS_V2 };
