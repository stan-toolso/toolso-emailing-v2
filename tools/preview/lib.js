const path = require('path');
const fs = require('fs');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const APPS = {
  api: path.join(ROOT, 'apps', 'api'),
  access: path.join(ROOT, 'apps', 'access'),
  ui: path.join(ROOT, 'apps', 'ui')
};
const DATA_DIR = path.join(ROOT, '.preview-data');

const log = (message) => console.log(`[preview] ${new Date().toISOString().substring(11, 19)} ${message}`);

/** Exécute une commande et échoue si elle sort en erreur. */
const run = (command, args, { cwd, env = {}, quiet = false } = {}) => {
  log(`$ ${command} ${args.join(' ')}  (${path.relative(ROOT, cwd) || '.'})`);
  const result = spawnSync(command, args, { cwd, env: { ...process.env, ...env }, stdio: quiet ? 'pipe' : 'inherit', shell: false });
  if (result.status !== 0) {
    if (quiet) {
      process.stderr.write(String(result.stdout || ''));
      process.stderr.write(String(result.stderr || ''));
    }
    throw new Error(`${command} ${args.join(' ')} failed with code ${result.status}`);
  }
  return result;
};

/** Lance un process enfant longue durée (sortie préfixée). */
const start = (name, command, args, { cwd, env = {} }) => {
  log(`start ${name}: ${command} ${args.join(' ')}`);
  const child = spawn(command, args, { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  const prefix = (stream) => {
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk.toString();
      let index;
      while ((index = buffer.indexOf('\n')) >= 0) {
        process.stdout.write(`[${name}] ${buffer.substring(0, index)}\n`);
        buffer = buffer.substring(index + 1);
      }
    });
  };
  prefix(child.stdout);
  prefix(child.stderr);
  child.on('exit', (code, signal) => log(`${name} exited (code ${code}, signal ${signal})`));
  return child;
};

const hasNodeModules = (dir) => fs.existsSync(path.join(dir, 'node_modules', '.package-lock.json'));

const waitForHttp = async (url, { attempts = 150, delayMs = 500, child } = {}) => {
  for (let i = 0; i < attempts; i++) {
    if (child && child.exitCode !== null) {
      throw new Error(`process exited before answering on ${url}`);
    }
    try {
      const res = await fetch(url);
      if (res.ok) {
        return res;
      }
    } catch (err) {
      // pas encore prêt
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error(`no answer on ${url}`);
};

module.exports = { ROOT, APPS, DATA_DIR, log, run, start, hasNodeModules, waitForHttp };
