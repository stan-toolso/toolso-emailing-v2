#!/usr/bin/env node
/**
 * Importe dans la table `Mirror` les miroirs exportés depuis DynamoDB `toolso-emailing-mirrors` (voir deploy/bin/migrate-mirrors.sh) :
 *   node scripts/import-mirrors.js --dir <dossier des pages JSON> [--bodies-dir <dossier des objets S3>] [--include-expired] [--any-uid]
 * Idempotent (upsert sur mirrorId). Lit .env (DATABASE_URL, RESOURCE_UID). Le schéma doit exister (npm run sync-model).
 */
require('dotenv').config();
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'INFO';
const { parseArgs } = require('util');
const fs = require('fs');
const log = require('../src/util/log').getLogger('ImportMirrors');
const { importMirrors } = require('../src/migration/dynamoMirror');

const { values } = parseArgs({
  options: {
    dir: { type: 'string' },
    'bodies-dir': { type: 'string' },
    'include-expired': { type: 'boolean', default: false },
    'any-uid': { type: 'boolean', default: false },
    'batch-size': { type: 'string', default: '500' }
  }
});

if (!values.dir || !fs.existsSync(values.dir)) {
  console.error('Usage: node scripts/import-mirrors.js --dir <dossier> [--bodies-dir <dossier>] [--include-expired] [--any-uid] [--batch-size 500]');
  process.exit(2);
}
if (values['bodies-dir'] && !fs.existsSync(values['bodies-dir'])) {
  console.error(`Dossier des corps introuvable : ${values['bodies-dir']}`);
  process.exit(2);
}

(async () => {
  const sequelizeModule = require('../src/storage/sequelize');
  const start = Date.now();
  try {
    const sequelize = await sequelizeModule.initWithPostgresql(2);
    const stats = await importMirrors({
      sequelize,
      dir: values.dir,
      bodiesDir: values['bodies-dir'],
      resourceUid: values['any-uid'] ? null : process.env.RESOURCE_UID,
      includeExpired: values['include-expired'],
      batchSize: parseInt(values['batch-size'], 10) || 500
    });
    const total = await sequelize.models.Mirror.count();
    log.info(`Import terminé en ${Math.round((Date.now() - start) / 1000)} s : ${JSON.stringify(stats)} ; ${total} miroirs en base`);
    console.log(JSON.stringify({ ...stats, totalInTable: total }));
    await sequelizeModule.close();
    process.exit(0);
  } catch (err) {
    log.error('Import des miroirs échoué', err);
    process.exit(1);
  }
})();
