#!/usr/bin/env node
/**
 * Synchronisation des statuts toolso-media → instance, à la main (le job planifié sync_media_statuses fait la même chose
 * toutes les heures quand MEDIA_STATUS_SYNC=1). Voir src/migration/mediaStatusSync.js et docs/06-migration-depuis-media.md.
 *   node scripts/sync-statuses-from-media.js [--product <uid>[,<uid>…]] [--dry-run] [--full] [--no-new-contacts]
 *        [--no-recalculate] [--email-flags-days 60] [--overlap-minutes 60] [--batch-size 1000] [--show-cursor]
 * Source : MEDIA_DATABASE_URL ; produits : --product, sinon MEDIA_PRODUCTS (.env de l'instance). Lit .env (DATABASE_URL…).
 * Même verrou PostgreSQL que le job : jamais deux synchronisations en même temps. Résumé JSON sur la sortie standard.
 */
require('dotenv').config();
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'INFO';
const { parseArgs } = require('util');
const log = require('../src/util/log').getLogger('SyncStatusesFromMedia');
const { syncStatusesFromMedia, configFromEnv, getCursor, DEFAULT_EMAIL_FLAGS_DAYS, DEFAULT_OVERLAP_MINUTES } = require('../src/migration/mediaStatusSync');

const usage = () => {
  console.error(
    [
      'Usage : MEDIA_DATABASE_URL=postgres://… node scripts/sync-statuses-from-media.js [--product <uid>[,<uid>…]] [--dry-run]',
      '          [--full] [--no-new-contacts] [--no-recalculate] [--email-flags-days 60] [--overlap-minutes 60]',
      '          [--batch-size 1000] [--show-cursor]'
    ].join('\n')
  );
  process.exit(2);
};

let values;
try {
  ({ values } = parseArgs({
    options: {
      product: { type: 'string', multiple: true },
      'dry-run': { type: 'boolean', default: false },
      full: { type: 'boolean', default: false },
      'no-new-contacts': { type: 'boolean', default: false },
      'no-recalculate': { type: 'boolean', default: false },
      'email-flags-days': { type: 'string', default: String(DEFAULT_EMAIL_FLAGS_DAYS) },
      'overlap-minutes': { type: 'string', default: String(DEFAULT_OVERLAP_MINUTES) },
      'batch-size': { type: 'string', default: '1000' },
      'show-cursor': { type: 'boolean', default: false },
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
const config = configFromEnv();
const products = (values.product ?? []).flatMap((p) => p.split(',')).map((p) => p.trim()).filter(Boolean);
const selected = products.length ? products : config.products;
const emailFlagsDays = parseInt(values['email-flags-days'], 10);
const overlapMinutes = parseInt(values['overlap-minutes'], 10);
const batchSize = parseInt(values['batch-size'], 10);
if ([emailFlagsDays, overlapMinutes].some((n) => isNaN(n) || n < 0) || isNaN(batchSize) || batchSize < 1) {
  console.error('--email-flags-days et --overlap-minutes attendent un entier ≥ 0, --batch-size un entier ≥ 1.');
  usage();
}

(async () => {
  const sequelizeModule = require('../src/storage/sequelize');
  const start = Date.now();
  try {
    const sequelize = await sequelizeModule.initWithPostgresql(5);
    if (values['show-cursor']) {
      console.log(JSON.stringify(await getCursor(sequelize), null, 2));
      await sequelizeModule.close();
      process.exit(0);
    }
    if (!config.sourceUrl) {
      console.error('MEDIA_DATABASE_URL manquant (URL PostgreSQL de la base media).');
      usage();
    }
    if (selected.length === 0) {
      console.error('Produits media non précisés : --product <uid> ou MEDIA_PRODUCTS dans le .env de l’instance.');
      usage();
    }
    if (!config.enabled) {
      log.warn('MEDIA_STATUS_SYNC n’est pas activé dans cette instance : le job planifié ne tourne pas (exécution manuelle seulement).');
    }
    // même verrou que le scheduler (entrypoints/scheduler.js) pour le job sync_media_statuses
    const { lockKey } = require('../src/entrypoints/scheduler');
    const lock = await sequelize.transaction();
    let stats;
    try {
      const [[row]] = await sequelize.query('SELECT pg_try_advisory_xact_lock(:key) AS locked', { replacements: { key: lockKey('sync_media_statuses') }, transaction: lock });
      if (!row.locked) {
        throw new Error('Une synchronisation est déjà en cours (job sync_media_statuses) : réessayer plus tard.');
      }
      stats = await syncStatusesFromMedia({
        sequelize,
        sourceUrl: config.sourceUrl,
        products: selected,
        dryRun: values['dry-run'],
        full: values.full,
        newContacts: !values['no-new-contacts'] && config.newContacts,
        recalculate: !values['no-recalculate'],
        emailFlagsDays,
        overlapMinutes,
        batchSize
      });
    } finally {
      await lock.commit().catch(() => {});
    }
    log.info(`${values['dry-run'] ? 'Simulation' : 'Synchronisation'} terminée en ${Math.round((Date.now() - start) / 1000)} s`);
    console.log(JSON.stringify(stats, null, 2));
    await sequelizeModule.close();
    process.exit(0);
  } catch (err) {
    log.error('Synchronisation des statuts depuis toolso-media échouée', err);
    await sequelizeModule.close().catch(() => {});
    process.exit(1);
  }
})();
