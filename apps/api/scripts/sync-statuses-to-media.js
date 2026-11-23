#!/usr/bin/env node
/**
 * Synchronisation inverse instance v2 → toolso-media (retour arrière d'un produit basculé ; voir
 * deploy/bin/sync-statuses-to-media.sh et docs/06-migration-depuis-media.md § 8) :
 *   MEDIA_DATABASE_URL=postgres://… node scripts/sync-statuses-to-media.js --product <uid>[,<uid>…] --since <AAAA-MM-JJ[THH:MM]>
 *                                        [--apply] [--batch-size 1000] [--inscriptions-csv]
 * Simulation par défaut (connexion media en lecture seule). --apply écrit dans media : MEDIA_DATABASE_URL doit alors être
 * celle d'un compte media en écriture limitée (UPDATE contact, INSERT contact_history, DELETE email).
 * --inscriptions-csv : au lieu du résumé, écrit en CSV les contacts inscrits dans la v2 depuis la bascule (à réimporter dans
 * media par son API). Lit .env (DATABASE_URL, RESOURCE_UID). Résumé JSON sur la sortie standard.
 */
require('dotenv').config();
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'INFO';
const { parseArgs } = require('util');
const { Client } = require('pg');
const moment = require('moment-timezone');
const log = require('../src/util/log').getLogger('SyncStatusesToMedia');
const media = require('../src/migration/mediaDatabase');
const reverse = require('../src/migration/mediaReverseSync');

const usage = () => {
  console.error(
    'Usage : MEDIA_DATABASE_URL=postgres://… node scripts/sync-statuses-to-media.js --product <uid>[,<uid>…] --since <AAAA-MM-JJ[THH:MM]> [--apply] [--batch-size 1000] [--inscriptions-csv]'
  );
  process.exit(2);
};

let values;
try {
  ({ values } = parseArgs({
    options: {
      product: { type: 'string', multiple: true },
      since: { type: 'string' },
      apply: { type: 'boolean', default: false },
      'batch-size': { type: 'string', default: String(media.DEFAULT_BATCH_SIZE) },
      'inscriptions-csv': { type: 'boolean', default: false },
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
const products = (values.product ?? [])
  .flatMap((p) => p.split(','))
  .map((p) => p.trim())
  .filter(Boolean);
const timezone = values.timezone || process.env.TZ || 'Europe/Paris';
const sinceMoment = values.since ? moment.tz(values.since, ['YYYY-MM-DD', 'YYYY-MM-DDTHH:mm', 'YYYY-MM-DD HH:mm', moment.ISO_8601], true, timezone) : null;
const batchSize = parseInt(values['batch-size'], 10);
if (!sourceUrl || products.length === 0 || !sinceMoment || !sinceMoment.isValid() || isNaN(batchSize) || batchSize < 1) {
  console.error("MEDIA_DATABASE_URL, --product et --since (date de bascule, fuseau de l'instance) sont obligatoires.");
  usage();
}
if (values.apply && values['inscriptions-csv']) {
  console.error('--inscriptions-csv est une lecture : ne pas le combiner avec --apply.');
  usage();
}

const csvCell = (v) => {
  if (v == null) {
    return '';
  }
  const s = v instanceof Date ? v.toISOString() : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

(async () => {
  let source;
  let sequelizeModule;
  try {
    source = new Client({ connectionString: sourceUrl, application_name: `toolso-emailing-v2 sync-statuses-to-media${values.apply ? '' : ' (simulation)'}` });
    await source.connect();
    if (!values.apply) {
      await source.query('SET default_transaction_read_only = on');
    }
    sequelizeModule = require('../src/storage/sequelize');
    const sequelize = await sequelizeModule.initWithPostgresql(5);
    const since = sinceMoment.toDate();
    if (values['inscriptions-csv']) {
      const resolved = await media.resolveProducts(source, products);
      const rows = await reverse.listInscriptions({ sequelize, source, productIds: resolved.map((p) => p.id), since });
      const cols = ['email', 'firstname', 'lastname', 'inscriptionDate', 'source', 'sourceName', 'status', 'mediaStatus'];
      console.log(cols.join(','));
      for (const r of rows) {
        console.log(cols.map((c) => csvCell(r[c])).join(','));
      }
    } else {
      const stats = await reverse.syncStatusesToMedia({ sequelize, source, products, since, apply: values.apply, batchSize });
      console.log(JSON.stringify(stats, null, 2));
    }
    await source.end();
    await sequelizeModule.close();
    process.exit(0);
  } catch (err) {
    log.error('Synchronisation v2 → media échouée', err);
    if (source) {
      await source.end().catch(() => {});
    }
    if (sequelizeModule) {
      await sequelizeModule.close().catch(() => {});
    }
    process.exit(1);
  }
})();
