/** scripts/enqueue-actions.js : rejeu de messages SQS (actions { type, payload }) dans la table ActionQueue, sur PostgreSQL embarqué. */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const { startEmbeddedPostgres } = require('../lib/embedded-pg');

jest.setTimeout(180000);

const ROOT = path.join(__dirname, '..', '..');
let pg;
let sequelizeModule;
let env;

beforeAll(async () => {
  pg = await startEmbeddedPostgres({ databaseDir: fs.mkdtempSync(path.join(os.tmpdir(), 'emailing-pg-')), persistent: false, quiet: true });
  env = { ...process.env, RESOURCE_UID: 'test', DATABASE_URL: pg.databaseUrl(), JWT_SECRET: 'test-secret', LOG_LEVEL: 'WARN' };
  Object.assign(process.env, env);
  process.chdir(ROOT);
  sequelizeModule = require('../../src/storage/sequelize');
  const sequelize = await sequelizeModule.initWithPostgresql(5);
  await sequelize.models.ActionQueue.sync({ force: true });
});

afterAll(async () => {
  await sequelizeModule.close();
  await pg.stop();
});

test('messages SQS et actions nues → ActionQueue (file huge pour export_contacts), lignes invalides ignorées', async () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'emailing-sqs-')), 'actions.ndjson');
  fs.writeFileSync(
    file,
    [
      JSON.stringify({ MessageId: 'a', ReceiptHandle: 'r1', Body: JSON.stringify({ type: 'insert_contact_event', payload: { email: 'a@example.com', type: 'open' } }) }),
      JSON.stringify({ MessageId: 'b', ReceiptHandle: 'r2', Body: JSON.stringify({ type: 'export_contacts', payload: { filters: {} } }) }),
      JSON.stringify({ type: 'log_payload', payload: { hello: 'world' } }),
      '',
      JSON.stringify({ MessageId: 'c', Body: '{"payload":{}}' }),
      'pas du json'
    ].join('\n') + '\n'
  );
  const out = execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'enqueue-actions.js'), '--file', file], { cwd: ROOT, env, stdio: 'pipe' }).toString();
  expect(JSON.parse(out.trim().split('\n').pop())).toEqual({ inserted: 3, invalid: 2 });

  const rows = await sequelizeModule.get().models.ActionQueue.findAll({ order: [['id', 'ASC']] });
  expect(rows.map((row) => [row.queue, row.type, row.status])).toEqual([
    ['default', 'insert_contact_event', 'pending'],
    ['huge', 'export_contacts', 'pending'],
    ['default', 'log_payload', 'pending']
  ]);
  expect(rows[0].payload).toEqual({ email: 'a@example.com', type: 'open' });
});
