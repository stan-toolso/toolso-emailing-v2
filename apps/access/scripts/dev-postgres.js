#!/usr/bin/env node
// PostgreSQL local de développement : `npm run dev-postgres [-- --port 5433]`.
// Les données sont conservées dans .pgdata/ ; la base `access` est créée si besoin ; la DATABASE_URL est affichée.
const path = require('path');
const { parseArgs } = require('util');
const { startEmbeddedPostgres } = require('./lib/embedded-pg');

const { values } = parseArgs({ options: { port: { type: 'string' }, dir: { type: 'string' } } });

(async () => {
  const databaseDir = path.resolve(values.dir || path.join(__dirname, '..', '.pgdata'));
  const pg = await startEmbeddedPostgres({ databaseDir, port: values.port ? parseInt(values.port, 10) : 5433, persistent: true });

  console.log(`\nPostgreSQL embarqué démarré (données : ${databaseDir})`);
  console.log(`DATABASE_URL=${pg.databaseUrl('access')}`);
  console.log(`Ctrl+C pour arrêter.\n`);

  const stop = async () => {
    await pg.stop();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
