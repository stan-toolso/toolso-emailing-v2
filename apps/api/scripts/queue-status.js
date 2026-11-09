#!/usr/bin/env node
/** État de la file d'actions : nombre d'actions par file, statut et type. */
require('dotenv').config();
(async () => {
  const sequelizeModule = require('../src/storage/sequelize');
  const sequelize = await sequelizeModule.initWithPostgresql(2);
  const [rows] = await sequelize.query('SELECT queue, status, type, COUNT(*) AS count, MIN("createdAt") AS oldest FROM "ActionQueue" GROUP BY 1,2,3 ORDER BY 1,2,3');
  console.table(rows);
  await sequelizeModule.close();
})();
