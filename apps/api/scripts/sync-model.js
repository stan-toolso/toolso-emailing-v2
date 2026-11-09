#!/usr/bin/env node
/**
 * Crée ou met à jour le schéma de la base emailing (équivalent du job `build_model` / `update_model_with_sequelize.js`) :
 * suppression des vues, `sequelize.sync({ alter: true })` sur les 41 modèles, puis le SQL complémentaire (vues, index trigram). Rejouable.
 *   node scripts/sync-model.js        (lit .env)
 */
require('dotenv').config();
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'INFO';
const log = require('../src/util/log').getLogger('SyncModel');
const { syncModel } = require('../src/storage/syncModel');

(async () => {
  const sequelizeModule = require('../src/storage/sequelize');
  try {
    const sequelize = await sequelizeModule.initWithPostgresql(5);
    log.info(`Sync model for ${process.env.RESOURCE_UID}`);
    await syncModel(sequelize);
    log.info('Model is up to date');
    await sequelizeModule.close();
    process.exit(0);
  } catch (err) {
    log.error('Sync model failed', err);
    process.exit(1);
  }
})();
