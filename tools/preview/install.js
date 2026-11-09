#!/usr/bin/env node
/**
 * Installation pour l'aperçu Skipper : dépendances des trois apps et build statique de l'UI.
 * Idempotent : `npm install` ne fait que la différence ; le build UI n'est refait que s'il manque
 * ou si PREVIEW_REBUILD_UI=1.
 */
const path = require('path');
const fs = require('fs');
const { APPS, log, run } = require('./lib');

(async () => {
  for (const app of ['api', 'access', 'ui']) {
    run('npm', ['install', '--no-audit', '--no-fund', '--ignore-scripts'], { cwd: APPS[app] });
  }
  const buildIndex = path.join(APPS.ui, 'build', 'index.html');
  if (fs.existsSync(buildIndex) && process.env.PREVIEW_REBUILD_UI !== '1') {
    log(`UI build already present (${buildIndex}), skipped. Set PREVIEW_REBUILD_UI=1 to rebuild.`);
  } else {
    log('Building UI (CRA 4, Node 22, CPU limités pour tenir dans 1 Gio)…');
    run('npx', ['react-scripts', 'build'], {
      cwd: APPS.ui,
      env: {
        NODE_OPTIONS: `--openssl-legacy-provider --require ${path.join(__dirname, 'limit-cpus.js')} --max-old-space-size=700`,
        GENERATE_SOURCEMAP: 'false',
        CI: 'false'
      }
    });
  }
  log('Install done.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
