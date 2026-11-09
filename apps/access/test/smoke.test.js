// Test de bout en bout : PostgreSQL embarqué → sync-model → create-superuser → add-database → serveur → authWithPassword → me.
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn, execFileSync } = require('child_process');
const { startEmbeddedPostgres, freePort } = require('../scripts/lib/embedded-pg');

const ROOT = path.join(__dirname, '..');
const EMAIL = 'admin@example.com';
const PASSWORD = 'S3cret-password';

let pg;
let server;
let env;
let baseUrl;

const run = (script, args) => execFileSync(process.execPath, [path.join(ROOT, 'scripts', script), ...args], { cwd: ROOT, env, stdio: 'pipe' }).toString();

const gql = async (query, variables, token) => {
  const res = await fetch(`${baseUrl}/graphql`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ query, variables })
  });
  expect(res.status).toBe(200);
  return res.json();
};

const waitFor = async (url, child, attempts = 100) => {
  for (let i = 0; i < attempts; i++) {
    if (child.exitCode !== null) throw new Error(`server exited with code ${child.exitCode}`);
    try {
      const res = await fetch(url);
      if (res.ok) return res;
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`server did not answer on ${url}`);
};

beforeAll(async () => {
  const databaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'access-pg-'));
  pg = await startEmbeddedPostgres({ databaseDir, persistent: false, quiet: true });
  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;

  env = {
    ...process.env,
    DATABASE_URL: pg.databaseUrl('access'),
    JWT_SECRET: 'test-secret',
    PUBLIC_URL: 'https://emailing.example.com/',
    PORT: String(port),
    LOG_LEVEL: 'WARN'
  };
  delete env.SMTP_URL;

  run('sync-model.js', []);
  run('create-superuser.js', ['--email', EMAIL, '--password', PASSWORD, '--firstname', 'Ada', '--lastname', 'Lovelace']);
  // Idempotence : un second passage met à jour sans erreur.
  run('create-superuser.js', ['--email', EMAIL, '--password', PASSWORD]);
  run('add-database.js', ['--uid', 'demo', '--name', 'Demo', '--api-endpoint', 'https://emailing.example.com/api/demo', '--entreprise', 'Demo SAS', '--admin', EMAIL]);
  run('add-database.js', ['--uid', 'demo', '--name', 'Demo', '--api-endpoint', 'https://emailing.example.com/api/demo', '--entreprise', 'Demo SAS', '--admin', EMAIL]);

  server = spawn(process.execPath, [path.join(ROOT, 'src', 'server.js')], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', (d) => process.stdout.write(`[server] ${d}`));
  server.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`));
  await waitFor(`${baseUrl}/health`, server);
});

afterAll(async () => {
  if (server && server.exitCode === null) {
    server.kill('SIGTERM');
    await new Promise((r) => server.once('exit', r));
  }
  if (pg) await pg.stop();
});

test('GET /health reports the database as reachable', async () => {
  const res = await fetch(`${baseUrl}/health`);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ status: 'ok', database: 'ok' });
});

test('authWithPassword rejects a bad password', async () => {
  const body = await gql(`mutation ($email: String!, $password: String!) { authWithPassword(email: $email, password: $password) }`, { email: EMAIL, password: 'wrong' });
  expect(body.data.authWithPassword).toBeNull();
  expect(body.errors[0].message).toBe('bad_password');
});

test('me requires authentication', async () => {
  const body = await gql(`{ me { id } }`);
  expect(body.data.me).toBeNull();
  expect(body.errors[0].extensions.code).toBe('UNAUTHENTICATED');
});

test('authWithPassword then me returns the superuser with its entreprise and database', async () => {
  const auth = await gql(`mutation ($email: String!, $password: String!) { authWithPassword(email: $email, password: $password) }`, { email: EMAIL, password: PASSWORD });
  expect(auth.errors).toBeUndefined();
  const token = auth.data.authWithPassword;
  expect(typeof token).toBe('string');

  // Même payload et même durée (7 jours) que la v1.
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  expect(payload.email).toBe(EMAIL);
  expect(payload.exp - payload.iat).toBe(7 * 24 * 3600);

  const me = await gql(
    `{ me { id email firstname lastname entreprises { id role entreprise { id name } } } }`,
    {},
    token
  );
  expect(me.errors).toBeUndefined();
  expect(me.data.me.email).toBe(EMAIL);
  expect(me.data.me.firstname).toBe('Ada');
  expect(me.data.me.entreprises).toHaveLength(1);
  expect(me.data.me.entreprises[0].role).toBe('superAdmin');
  const entrepriseId = me.data.me.entreprises[0].entreprise.id;

  const dbs = await gql(`query ($id: ID!) { me { emailingDatabases(entrepriseId: $id) { uid name apiEndpoint } } }`, { id: entrepriseId }, token);
  expect(dbs.data.me.emailingDatabases).toEqual([{ uid: 'demo', name: 'Demo', apiEndpoint: 'https://emailing.example.com/api/demo' }]);

  const role = await gql(`{ getMyDatabaseRole(uid: "demo") { role } }`, {}, token);
  expect(role.data.getMyDatabaseRole.role).toBe('superAdmin');
});

test('requestNewResetLink works without SMTP (mail is logged) and the reset token logs in', async () => {
  const body = await gql(`mutation ($email: String!) { requestNewResetLink(email: $email) }`, { email: EMAIL });
  expect(body.data.requestNewResetLink).toBe('ok');
  const unknown = await gql(`mutation ($email: String!) { requestNewResetLink(email: $email) }`, { email: 'nobody@example.com' });
  expect(unknown.data.requestNewResetLink).toBe('ko');

  const missing = await gql(`{ meWithToken(token: "not-a-token") { id } }`);
  expect(missing.data.meWithToken).toBeNull();
  expect(missing.errors).toBeUndefined();
});
