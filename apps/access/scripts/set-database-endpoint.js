#!/usr/bin/env node
// Ajuste apiEndpoint / enabled des bases emailing déclarées dans l'access API, après reprise de la base access d'AWS :
//   npm run set-database-endpoint -- --list
//   npm run set-database-endpoint -- --uid clubdesjeux --api-endpoint https://hote/api/clubdesjeux        (active la base)
//   npm run set-database-endpoint -- --uid a --uid b --api-base https://hote/api [--disable-others]     (apiEndpoint = <api-base>/<uid>)
//   npm run set-database-endpoint -- --uid ancienne --disable                                           (enabled = false)
// --disable-others désactive toutes les bases non citées (celles restées sur AWS). Idempotent.
require('dotenv').config();
const { parseArgs } = require('util');
const log = require('../src/log').getLogger('SetDatabaseEndpoint');
const { initAccess } = require('../src/storage/sequelize');

const { values } = parseArgs({
  options: {
    uid: { type: 'string', multiple: true },
    'api-endpoint': { type: 'string' },
    'api-base': { type: 'string' },
    disable: { type: 'boolean', default: false },
    'disable-others': { type: 'boolean', default: false },
    list: { type: 'boolean', default: false }
  }
});

const usage = () => {
  console.error('Usage: npm run set-database-endpoint -- --list | --uid <uid> [--uid <uid>…] (--api-endpoint <url> | --api-base <url> | --disable) [--disable-others]');
  process.exit(2);
};

const uids = (values.uid || []).map((uid) => uid.trim()).filter(Boolean);
const trim = (url) => url.replace(/\/+$/, '');
if (!values.list) {
  if (uids.length === 0) usage();
  if (values.disable && (values['api-endpoint'] || values['api-base'])) usage();
  if (!values.disable && !values['api-endpoint'] && !values['api-base']) usage();
  if (values['api-endpoint'] && uids.length !== 1) {
    console.error('--api-endpoint ne vaut que pour un seul --uid ; utiliser --api-base pour plusieurs bases.');
    process.exit(2);
  }
}

(async () => {
  const sequelize = await initAccess(true);
  const { EmailingDatabase } = sequelize.models;
  let exitCode = 0;

  for (const uid of uids) {
    const database = await EmailingDatabase.findOne({ where: { uid } });
    if (!database) {
      log.error(`EmailingDatabase ${uid} not found (npm run add-database to create it)`);
      exitCode = 1;
      continue;
    }
    if (values.disable) {
      database.enabled = false;
      log.info(`EmailingDatabase ${uid} disabled`);
    } else {
      database.apiEndpoint = values['api-endpoint'] ? trim(values['api-endpoint']) : `${trim(values['api-base'])}/${uid}`;
      database.enabled = true;
      log.info(`EmailingDatabase ${uid} enabled, apiEndpoint = ${database.apiEndpoint}`);
    }
    await database.save();
  }

  if (values['disable-others']) {
    const { Op } = require('sequelize');
    const [count] = await EmailingDatabase.update({ enabled: false }, { where: { uid: { [Op.notIn]: uids }, enabled: true } });
    log.info(`${count} other database(s) disabled`);
  }

  const rows = await EmailingDatabase.findAll({ order: [['uid', 'ASC']], attributes: ['id', 'uid', 'name', 'enabled', 'apiEndpoint', 'entrepriseId'] });
  console.table(rows.map((row) => row.get({ plain: true })));
  await sequelize.close();
  process.exit(exitCode);
})().catch((err) => {
  log.error('Failed to update databases', err);
  process.exit(1);
});
