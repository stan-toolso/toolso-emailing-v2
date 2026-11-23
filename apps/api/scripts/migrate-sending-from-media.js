#!/usr/bin/env node
/**
 * Reprend la configuration d'envoi d'un produit toolso-media : expéditeurs (routeurs sans identifiants), configurations
 * d'envoi et créneaux (planifications v2 créées DÉSACTIVÉES).
 *   MEDIA_DATABASE_URL=postgres://… node scripts/migrate-sending-from-media.js --product <uid>
 *        [--senders-only | --slots-only] [--slot-time HH:MM[,HH:MM…] | --slot-time <id>=HH:MM[,…]]… [--tracking-domain <url>] [--dry-run]
 * Lit .env (DATABASE_URL, RESOURCE_UID, API_PUBLIC_URL, TRACKING_HOSTS). Idempotent (config.media identifie l'origine).
 * Résumé JSON sur la sortie standard. Voir docs/06-migration-depuis-media.md § 10.
 */
require('dotenv').config();
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'INFO';
const { parseArgs } = require('util');
const log = require('../src/util/log').getLogger('MigrateSendingFromMedia');

const usage = () => {
  console.error(
    'Usage : MEDIA_DATABASE_URL=… node scripts/migrate-sending-from-media.js --product <uid>[,<uid>…] [--senders-only | --slots-only] [--slot-time HH:MM[,…] | --slot-time <id>=HH:MM[,…]]… [--tracking-domain <url>] [--dry-run]'
  );
  process.exit(2);
};

let values;
try {
  ({ values } = parseArgs({
    options: {
      product: { type: 'string', multiple: true },
      'senders-only': { type: 'boolean', default: false },
      'slots-only': { type: 'boolean', default: false },
      'slot-time': { type: 'string', multiple: true },
      'tracking-domain': { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', default: false }
    }
  }));
} catch (err) {
  console.error(err.message);
  usage();
}
if (values.help || (values['senders-only'] && values['slots-only'])) {
  usage();
}
const sourceUrl = process.env.MEDIA_DATABASE_URL;
if (!sourceUrl) {
  console.error('MEDIA_DATABASE_URL manquant (URL PostgreSQL de la base media).');
  usage();
}
const products = (values.product ?? [])
  .flatMap((p) => p.split(','))
  .map((p) => p.trim())
  .filter(Boolean);

(async () => {
  const sequelizeModule = require('../src/storage/sequelize');
  try {
    const sequelize = await sequelizeModule.initWithPostgresql(5);
    const { migrateSendingFromMedia } = require('../src/migration/mediaSending');
    const stats = await migrateSendingFromMedia({
      sequelize,
      sourceUrl,
      products,
      senders: !values['slots-only'],
      slots: !values['senders-only'],
      slotTimes: values['slot-time'] ?? [],
      trackingDomain: values['tracking-domain'],
      dryRun: values['dry-run']
    });
    for (const w of stats.warnings) {
      log.warn(w);
    }
    console.log(JSON.stringify(stats, null, 2));
    await sequelizeModule.close();
    process.exit(0);
  } catch (err) {
    log.error("Reprise de la configuration d'envoi depuis toolso-media échouée", err);
    await sequelizeModule.close().catch(() => {});
    process.exit(1);
  }
})();
