// scripts/set-database-endpoint.js sur PostgreSQL embarqué : apiEndpoint / enabled après reprise de la base access d'AWS.
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const { startEmbeddedPostgres } = require('../scripts/lib/embedded-pg');

const ROOT = path.join(__dirname, '..');
let pg;
let env;

const run = (script, args, options = {}) => {
  try {
    return { code: 0, out: execFileSync(process.execPath, [path.join(ROOT, 'scripts', script), ...args], { cwd: ROOT, env, stdio: 'pipe' }).toString() };
  } catch (err) {
    if (options.allowFailure) return { code: err.status, out: `${err.stdout}${err.stderr}` };
    throw err;
  }
};

beforeAll(async () => {
  pg = await startEmbeddedPostgres({ databaseDir: fs.mkdtempSync(path.join(os.tmpdir(), 'access-pg-')), persistent: false, quiet: true });
  env = { ...process.env, DATABASE_URL: pg.databaseUrl('access'), JWT_SECRET: 'test-secret', PUBLIC_URL: 'https://emailing.example.com', LOG_LEVEL: 'WARN' };
  delete env.SMTP_URL;
  run('sync-model.js', []);
  // trois bases « venues d'AWS » : deux migrées, une qui reste sur AWS
  for (const uid of ['clubdesjeux', 'elixis_gm', 'reste_aws']) {
    run('add-database.js', ['--uid', uid, '--name', uid, '--api-endpoint', `https://xyz.execute-api.eu-west-1.amazonaws.com/${uid}`, '--entreprise', `Entreprise ${uid}`]);
  }
});

afterAll(async () => {
  if (pg) await pg.stop();
});

const databases = async () => {
  const { initAccess } = require('../src/storage/sequelize');
  process.env.DATABASE_URL = env.DATABASE_URL;
  const sequelize = await initAccess(true);
  const rows = await sequelize.models.EmailingDatabase.findAll({ order: [['uid', 'ASC']] });
  await sequelize.close();
  return Object.fromEntries(rows.map((row) => [row.uid, { enabled: row.enabled, apiEndpoint: row.apiEndpoint }]));
};

test('--api-base pour plusieurs bases et --disable-others', async () => {
  const { out } = run('set-database-endpoint.js', ['--uid', 'clubdesjeux', '--uid', 'elixis_gm', '--api-base', 'https://emailing.example.com/api/', '--disable-others']);
  expect(out).toContain('clubdesjeux');
  expect(await databases()).toEqual({
    clubdesjeux: { enabled: true, apiEndpoint: 'https://emailing.example.com/api/clubdesjeux' },
    elixis_gm: { enabled: true, apiEndpoint: 'https://emailing.example.com/api/elixis_gm' },
    reste_aws: { enabled: false, apiEndpoint: 'https://xyz.execute-api.eu-west-1.amazonaws.com/reste_aws' }
  });
});

test('--api-endpoint pour une base, --disable, --list, uid inconnu', async () => {
  run('set-database-endpoint.js', ['--uid', 'reste_aws', '--api-endpoint', 'https://emailing.example.com/api/reste_aws/']);
  expect((await databases()).reste_aws).toEqual({ enabled: true, apiEndpoint: 'https://emailing.example.com/api/reste_aws' });

  run('set-database-endpoint.js', ['--uid', 'elixis_gm', '--disable']);
  expect((await databases()).elixis_gm.enabled).toBe(false);

  expect(run('set-database-endpoint.js', ['--list']).out).toContain('reste_aws');
  expect(run('set-database-endpoint.js', ['--uid', 'inconnue', '--api-base', 'https://x'], { allowFailure: true }).code).toBe(1);
  expect(run('set-database-endpoint.js', ['--uid', 'a', '--uid', 'b', '--api-endpoint', 'https://x'], { allowFailure: true }).code).toBe(2);
  expect(run('set-database-endpoint.js', [], { allowFailure: true }).code).toBe(2);
});
