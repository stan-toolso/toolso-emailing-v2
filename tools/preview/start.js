#!/usr/bin/env node
/**
 * Aperçu Skipper : toute la pile sur un seul port ($PORT).
 *   PostgreSQL embarqué (.preview-data/pg) → access (4000) → api ROLE=all (4001) → serveur statique + proxy ($PORT)
 * Compte de démonstration : admin@example.com / preview-admin, base « demo ».
 * Les mails ne sont pas envoyés (pas de SMTP) : ils sont journalisés par les process.
 */
const path = require('path');
const fs = require('fs');
const { ROOT, APPS, DATA_DIR, log, run, start, hasNodeModules, waitForHttp } = require('./lib');
const { createServer } = require('./server');

const PORT = parseInt(process.env.PORT || '3000', 10);
const UID = 'demo';
const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'preview-admin';
const JWT_SECRET = process.env.PREVIEW_JWT_SECRET || 'preview-jwt-secret-not-for-production';

const children = [];
let pg = null;

const shutdown = async (signal) => {
  log(`${signal}: stopping`);
  for (const child of children) {
    try {
      child.kill('SIGTERM');
    } catch (err) {
      // déjà arrêté
    }
  }
  if (pg) {
    try {
      await pg.stop();
    } catch (err) {
      log(`postgres stop: ${err.message}`);
    }
  }
  process.exit(0);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

(async () => {
  for (const app of ['api', 'access']) {
    if (!hasNodeModules(APPS[app])) {
      throw new Error(`apps/${app}/node_modules missing: run "node tools/preview/install.js" first`);
    }
  }
  const uiDir = path.join(APPS.ui, 'build');
  if (!fs.existsSync(path.join(uiDir, 'index.html'))) {
    throw new Error(`UI build missing (${uiDir}): run "node tools/preview/install.js" first`);
  }

  // 1. PostgreSQL embarqué (données conservées entre deux lancements)
  const { startEmbeddedPostgres } = require(path.join(APPS.api, 'test', 'lib', 'embedded-pg.js'));
  const pgDir = path.join(DATA_DIR, 'pg');
  fs.mkdirSync(pgDir, { recursive: true });
  pg = await startEmbeddedPostgres({ databaseDir: pgDir, persistent: true, databases: ['access', `emailing_${UID}`], quiet: true });
  log(`PostgreSQL ready on port ${pg.port}`);

  const filesDir = path.join(DATA_DIR, 'files');
  fs.mkdirSync(filesDir, { recursive: true });

  const accessEnv = {
    DATABASE_URL: pg.databaseUrl('access'),
    JWT_SECRET,
    PORT: '4000',
    PUBLIC_URL: process.env.PREVIEW_PUBLIC_URL || `http://localhost:${PORT}`,
    LOG_LEVEL: process.env.LOG_LEVEL || 'INFO',
    SMTP_URL: ''
  };
  const apiEnv = {
    RESOURCE_UID: UID,
    ROLE: 'all',
    PORT: '4001',
    DATABASE_URL: pg.databaseUrl(`emailing_${UID}`),
    JWT_SECRET,
    PUBLIC_URL: accessEnv.PUBLIC_URL,
    API_PUBLIC_URL: `/api/${UID}`,
    FILES_DIR: filesDir,
    FILES_PUBLIC_URL: `/files/${UID}`,
    ACCESS_API_URL: 'http://127.0.0.1:4000/graphql',
    SUPPORT_EMAIL: ADMIN_EMAIL,
    LOG_LEVEL: process.env.LOG_LEVEL || 'INFO',
    SMTP_URL: ''
  };

  // 2. Schémas et données de démonstration (idempotent)
  run('node', ['scripts/sync-model.js'], { cwd: APPS.access, env: accessEnv, quiet: true });
  run('node', ['scripts/create-superuser.js', '--email', ADMIN_EMAIL, '--password', ADMIN_PASSWORD, '--firstname', 'Admin', '--lastname', 'Aperçu'], { cwd: APPS.access, env: accessEnv, quiet: true });
  run('node', ['scripts/add-database.js', '--uid', UID, '--name', 'Base de démonstration', '--api-endpoint', `/api/${UID}`, '--entreprise', 'Démo', '--admin', ADMIN_EMAIL], { cwd: APPS.access, env: accessEnv, quiet: true });
  run('node', ['scripts/sync-model.js'], { cwd: APPS.api, env: apiEnv, quiet: true });

  // 3. Process applicatifs
  children.push(start('access', 'node', ['src/server.js'], { cwd: APPS.access, env: accessEnv }));
  await waitForHttp('http://127.0.0.1:4000/health', { child: children[0] });
  children.push(start('api', 'node', ['src/main.js'], { cwd: APPS.api, env: apiEnv }));
  await waitForHttp('http://127.0.0.1:4001/health', { child: children[1] });

  // 4. Front : statique + proxy
  const server = createServer({ uiDir, filesDir: path.join(filesDir, 'exports'), uid: UID });
  server.listen(PORT, '0.0.0.0', () => {
    log(`Preview ready on http://0.0.0.0:${PORT}  (login ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}, database "${UID}")`);
  });
})().catch(async (err) => {
  console.error(err);
  await shutdown('startup failure');
});
