#!/usr/bin/env node
// Crée ou met à jour les tables access (sequelize.sync({ alter: true })) : `npm run sync-model`.
require('dotenv').config();
const log = require('../src/log').getLogger('SyncModel');
const { initAccess } = require('../src/storage/sequelize');

(async () => {
  log.info('Start to sync access model');
  const sequelize = await initAccess(true);
  await sequelize.sync({ force: false, alter: true });
  log.info('Model is sync !');
  await sequelize.close();
})().catch((err) => {
  log.error('Failed to sync access model', err);
  process.exit(1);
});
