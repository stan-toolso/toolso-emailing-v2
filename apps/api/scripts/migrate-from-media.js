#!/usr/bin/env node
/**
 * Reprend une base toolso-media (un ou plusieurs produits) dans la base de l'instance (voir deploy/bin/migrate-from-media.sh
 * et docs/06-migration-depuis-media.md) :
 *   MEDIA_DATABASE_URL=postgres://… node scripts/migrate-from-media.js --list-products
 *   MEDIA_DATABASE_URL=postgres://… node scripts/migrate-from-media.js --product <uid> --inventory
 *   MEDIA_DATABASE_URL=postgres://… node scripts/migrate-from-media.js --product <uid>[,<uid>…] [--since-days 90] [--dry-run]
 *                                        [--batch-size 1000] [--skip-blacklist] [--skip-messages] [--timezone Europe/Paris]
 * L'URL de la source est lue dans MEDIA_DATABASE_URL (jamais sur la ligne de commande). Lit .env (DATABASE_URL, RESOURCE_UID).
 * Le schéma cible doit exister (npm run sync-model). Idempotent : les contacts déjà présents (même e-mail) sont ignorés.
 * Affiche un résumé JSON sur la sortie standard en fin d'exécution.
 */
require('dotenv').config();
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'INFO';
const { parseArgs } = require('util');
const log = require('../src/util/log').getLogger('MigrateFromMedia');
const media = require('../src/migration/mediaDatabase');

const usage = () => {
  console.error(
    [
      'Usage : MEDIA_DATABASE_URL=postgres://… node scripts/migrate-from-media.js [--product <uid>[,<uid>…]]',
      '          [--list-products | --inventory | --dry-run] [--since-days 90] [--batch-size 1000]',
      '          [--skip-blacklist] [--skip-messages] [--timezone Europe/Paris]'
    ].join('\n')
  );
  process.exit(2);
};

let values;
try {
  ({ values } = parseArgs({
    options: {
      product: { type: 'string', multiple: true },
      'list-products': { type: 'boolean', default: false },
      inventory: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      'since-days': { type: 'string', default: String(media.DEFAULT_SINCE_DAYS) },
      'batch-size': { type: 'string', default: String(media.DEFAULT_BATCH_SIZE) },
      'skip-blacklist': { type: 'boolean', default: false },
      'skip-messages': { type: 'boolean', default: false },
      timezone: { type: 'string' },
      help: { type: 'boolean', default: false }
    }
  }));
} catch (err) {
  console.error(err.message);
  usage();
}
if (values.help) {
  usage();
}
const sourceUrl = process.env.MEDIA_DATABASE_URL;
if (!sourceUrl) {
  console.error('MEDIA_DATABASE_URL manquant (URL PostgreSQL de la base media).');
  usage();
}
const products = (values.product ?? []).flatMap((p) => p.split(',')).map((p) => p.trim()).filter(Boolean);
const sinceDays = parseInt(values['since-days'], 10);
const batchSize = parseInt(values['batch-size'], 10);
if (isNaN(sinceDays) || sinceDays < 0 || isNaN(batchSize) || batchSize < 1) {
  console.error('--since-days attend un entier ≥ 0, --batch-size un entier ≥ 1.');
  usage();
}

const printInventory = (inv) => {
  const lines = [];
  lines.push(`Produits : ${inv.products.map((p) => `${p.uid} (#${p.id}, ${p.name}${p.disabled ? ', désactivé' : ''}, ${p.contacts} contacts)`).join(' ; ')}`);
  const c = inv.counts;
  lines.push(`Repris    : ${c.contacts} contacts (${c.contacts_without_inscription} sans inscription → inscription synthétique), ${c.inscriptions} inscriptions, ${c.sources} sources, ${c.recent_emails} envois depuis ${inv.sinceDays} j, ${c.status_history} événements de statut (historique), ${c.messages} messages, ${c.blacklisted} empreintes blacklistées (toute la base media)`);
  lines.push(`Non repris : ${inv.senders.length} expéditeurs, ${c.sending_configs} configurations d'envoi, ${c.contents} contenus, ${c.templates} gabarits, ${c.users} utilisateurs media`);
  lines.push('Contacts par statut media :');
  for (const row of inv.contactsByStatus) {
    const product = inv.products.find((p) => p.id === row.product_id);
    lines.push(`   ${product ? product.uid : row.product_id}  ${row.email_status.padEnd(14)} ${row.n}`);
  }
  if (inv.senders.length) {
    lines.push('Expéditeurs media (à recréer dans l\'UI avec leur routeur) :');
    for (const s of inv.senders) {
      lines.push(`   #${s.id}  ${s.name}  <${s.email}>  routeur=${s.router ?? '-'}`);
    }
  }
  if (inv.settings.length) {
    lines.push('Paramètres media utiles :');
    for (const s of inv.settings) {
      lines.push(`   ${s.product_id ?? 'global'}  ${s.name} = ${s.value}`);
    }
  }
  console.log(lines.join('\n'));
};

(async () => {
  const start = Date.now();
  let source = null;
  let sequelizeModule = null;
  try {
    source = await media.openSource(sourceUrl);
    if (values['list-products']) {
      for (const p of await media.listProducts(source)) {
        console.log(`${String(p.id).padStart(4)}  ${p.uid.padEnd(24)} ${String(p.contacts).padStart(9)} contacts  ${p.name}${p.disabled ? '  (désactivé)' : ''}`);
      }
      await source.end();
      process.exit(0);
    }
    const resolved = await media.resolveProducts(source, products);
    const inv = await media.inventory(source, resolved, { sinceDays });
    printInventory(inv);
    if (values.inventory) {
      await source.end();
      process.exit(0);
    }

    sequelizeModule = require('../src/storage/sequelize');
    const sequelize = await sequelizeModule.initWithPostgresql(5);
    const before = await sequelize.models.Contact.count();
    log.info(`Base cible ${process.env.RESOURCE_UID} : ${before} contacts avant reprise`);
    const stats = await media.migrateFromMedia({
      sequelize,
      source,
      products: resolved.map((p) => p.uid),
      sinceDays,
      batchSize,
      dryRun: values['dry-run'],
      skipBlacklist: values['skip-blacklist'],
      skipMessages: values['skip-messages'],
      timezone: values.timezone,
      onProgress: (p) => log.info(`${p.product} : ${p.created} contacts créés, ${p.existing} déjà présents, ${p.invalidEmail} e-mails invalides, ${p.duplicates} doublons (lu jusqu'à l'id ${p.lastId})`)
    });
    const after = await sequelize.models.Contact.count();
    log.info(`${values['dry-run'] ? 'Simulation' : 'Reprise'} terminée en ${Math.round((Date.now() - start) / 1000)} s ; ${after} contacts en base`);
    console.log(JSON.stringify({ ...stats, contactsInTable: after }, null, 2));
    await source.end();
    await sequelizeModule.close();
    process.exit(0);
  } catch (err) {
    log.error('Reprise depuis toolso-media échouée', err);
    if (source) {
      await source.end().catch(() => {});
    }
    if (sequelizeModule) {
      await sequelizeModule.close().catch(() => {});
    }
    process.exit(1);
  }
})();
