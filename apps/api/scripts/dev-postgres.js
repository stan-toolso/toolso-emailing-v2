#!/usr/bin/env node
/**
 * PostgreSQL de développement (sans Docker) via le paquet `embedded-postgres` : démarre une instance dans `.pgdata/`,
 * crée la base `emailing_dev` et affiche la DATABASE_URL à mettre dans `.env`. Ctrl+C pour arrêter.
 */
const path = require('path');
(async () => {
  const EmbeddedPostgres = require('embedded-postgres').default ?? require('embedded-postgres');
  const port = parseInt(process.env.DEV_PG_PORT || '5433', 10);
  const pg = new EmbeddedPostgres({
    databaseDir: path.join(__dirname, '..', '.pgdata'),
    user: 'postgres',
    password: 'postgres',
    port,
    persistent: true
  });
  const fs = require('fs');
  if (!fs.existsSync(path.join(__dirname, '..', '.pgdata', 'PG_VERSION'))) {
    await pg.initialise();
  }
  await pg.start();
  try {
    await pg.createDatabase('emailing_dev');
  } catch (err) {
    // existe déjà
  }
  console.log(`PostgreSQL ready: DATABASE_URL=postgres://postgres:postgres@localhost:${port}/emailing_dev`);
  const stop = async () => {
    await pg.stop();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
})();
