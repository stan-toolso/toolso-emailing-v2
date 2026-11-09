/**
 * Test de bout en bout de l'instance autonome sur un PostgreSQL embarqué :
 * schéma (sync-model) → API HTTP (health, upload, miroir, pixel, webhook) → file d'actions → worker → scheduler (verrou).
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const CryptoJS = require('crypto-js');
const jwt = require('jsonwebtoken');
const { startEmbeddedPostgres } = require('../lib/embedded-pg');

jest.setTimeout(180000);

const ROOT = path.join(__dirname, '..', '..');
let pg;
let filesDir;
let app;
let request;
let sequelizeModule;

beforeAll(async () => {
  const databaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emailing-pg-'));
  filesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emailing-files-'));
  pg = await startEmbeddedPostgres({ databaseDir, persistent: false, quiet: true });

  Object.assign(process.env, {
    RESOURCE_UID: 'test',
    DATABASE_URL: pg.databaseUrl(),
    JWT_SECRET: 'test-secret',
    PUBLIC_URL: 'https://emailing.example.com',
    API_PUBLIC_URL: 'https://emailing.example.com/api/test',
    FILES_DIR: filesDir,
    FILES_PUBLIC_URL: 'https://emailing.example.com/files/test',
    LOG_LEVEL: 'WARN'
  });
  delete process.env.SMTP_URL;
  process.chdir(ROOT);

  sequelizeModule = require('../../src/storage/sequelize');
  const sequelize = await sequelizeModule.initWithPostgresql(5);
  const { syncModel } = require('../../src/storage/syncModel');
  await syncModel(sequelize);
  // rejouable : un second passage (mise à jour d'une base existante) ne doit pas échouer sur les vues
  await syncModel(sequelize);

  app = require('../../src/api/api').initApi();
  request = require('supertest')(app);
});

afterAll(async () => {
  await sequelizeModule.close();
  await pg.stop();
});

const models = () => sequelizeModule.get().models;

test("schéma : les tables d'origine et les nouvelles tables existent", async () => {
  const rows = await sequelizeModule
    .get()
    .query(`SELECT table_name AS name FROM information_schema.tables WHERE table_schema = 'public' UNION SELECT table_name FROM information_schema.views WHERE table_schema = 'public'`, {
      type: require('sequelize').QueryTypes.SELECT
    });
  const tables = rows.map((row) => row.name);
  for (const expected of ['Contact', 'ContactEvent', 'Schedule', 'Content', 'Settings', 'ActionQueue', 'Mirror', 'ScheduleReport']) {
    expect(tables).toContain(expected);
  }
});

test('GET /health répond ok', async () => {
  const res = await request.get('/health');
  expect(res.status).toBe(200);
  expect(res.body.status).toBe('ok');
  expect(res.body.uid).toBe('test');
});

test('upload direct : generateUploadUrl puis PUT /uploads/:key (contrat react-s3-uploader)', async () => {
  const token = jwt.sign({ id: 1, email: 'user@example.com' }, 'test-secret');
  const generateUploadUrl = require('../../src/api/graphql/resolvers/generateUploadUrl');
  const result = await generateUploadUrl(null, { fileName: 'liste.csv', fileType: 'text/csv' }, { encryptedToken: token });
  expect(result.s3Key).toMatch(/_liste\.csv$/);
  expect(result.signedUrl.startsWith('https://emailing.example.com/api/test/uploads/')).toBe(true);

  // en production nginx retire le préfixe /api/<uid> avant de joindre l'api
  const url = new URL(result.signedUrl);
  const res = await request
    .put(url.pathname.replace('/api/test', '') + url.search)
    .set('content-type', 'text/csv')
    .set('x-amz-acl', 'public-read')
    .set('content-disposition', 'attachment; filename="liste.csv"')
    .send('a@example.com,1\nb@example.com,2\n');
  expect(res.status).toBe(200);

  const { readFile, Folders } = require('../../src/services/FileStorageService');
  const stored = await readFile(result.s3Key, Folders.emailing_tmp_files);
  expect(stored.Body.toString()).toContain('b@example.com');

  const unauthorized = await request.put(`/uploads/${result.s3Key}`).send('x');
  expect(unauthorized.status).toBe(401);
});

test('miroir : stockage puis page /m/:mirrorId', async () => {
  const MirrorService = require('../../src/services/MirrorService');
  const mirrorService = new MirrorService();
  const mirrorId = '11111111-2222-4333-8444-555555555555';
  await mirrorService.store({
    mirrorId,
    messageId: 'msg-1',
    to: 'contact@example.com',
    subject: 'Bonjour',
    source: 'Expéditeur <no-reply@example.com>',
    html: '<html><body><h1>Vue en ligne</h1></body></html>'
  });

  const res = await request.get(`/m/${mirrorId}`);
  expect(res.status).toBe(200);
  expect(res.text).toContain('Vue en ligne');
  expect(await mirrorService.getMessageId(mirrorId)).toBe('msg-1');

  const missing = await request.get('/m/00000000-0000-4000-8000-000000000000');
  expect(missing.status).toBe(404);

  // sans lien miroir dans le mail : la ligne existe (tracking) mais sans corps
  await mirrorService.store({ mirrorId: '22222222-2222-4333-8444-555555555555', messageId: 'msg-2', to: 'c2@example.com', subject: 's', source: 'x', html: '<p>x</p>', storeBody: false });
  expect(await mirrorService.getBody('22222222-2222-4333-8444-555555555555')).toBeNull();
});

test("tracking : pixel d'ouverture et clic → actions track_event → événement toolso", async () => {
  const mirrorId = '11111111-2222-4333-8444-555555555555';
  const key = 'k3y12345';
  const encrypted = encodeURIComponent(CryptoJS.AES.encrypt(JSON.stringify({ mirrorId }), key).toString());
  const pixel = await request.get(`/tko/v1/${key}/${encrypted}`).set('user-agent', 'Mozilla/5.0 (test)');
  expect(pixel.status).toBe(200);
  expect(pixel.headers['content-type']).toContain('image/gif');

  const clickObj = encodeURIComponent(CryptoJS.AES.encrypt(JSON.stringify({ href: 'https://www.example.com/page', mirrorId }), key).toString());
  const click = await request.get(`/tkc/v1/${key}/${clickObj}`);
  expect(click.status).toBe(302);
  expect(click.headers.location).toBe('https://www.example.com/page');

  const ActionService = require('../../src/services/ActionService');
  const actionService = new ActionService();
  const queued = await models().ActionQueue.findAll({ where: { type: 'track_event' }, order: [['id', 'ASC']] });
  expect(queued.map((action) => action.payload.eventType)).toEqual(['Open', 'Click']);

  // le worker exécute track_event : l'événement devient une action insert_contact_event (comme le webhook toolso)
  const { executeAction } = require('../../src/queue/executeAction');
  const claimed = await actionService.claim('default', 10);
  expect(claimed.length).toBe(2);
  for (const action of claimed) {
    await executeAction(action);
    await actionService.complete(action.id);
  }
  const events = await models().ActionQueue.findAll({ where: { type: 'insert_contact_event' }, order: [['id', 'ASC']] });
  expect(events.map((action) => action.payload.eventType)).toEqual(['open', 'click']);
  expect(events[0].payload.email).toBe('contact@example.com');
  expect(events[0].payload.messageId).toBe('msg-1');
  expect(events[1].payload.details.link).toBe('https://www.example.com/page');
  expect(await actionService.countActions()).toBe(2);
  await models().ActionQueue.destroy({ where: {} });
});

test('désabonnement : page GET puis POST crée un événement unsub', async () => {
  const key = 'unsubkey';
  const obj = encodeURIComponent(CryptoJS.AES.encrypt(JSON.stringify({ email: 'contact@example.com', mirrorId: '11111111-2222-4333-8444-555555555555', uid: 'test' }), key).toString());
  const page = await request.get(`/unsub/fr/${key}/${obj}`);
  expect(page.status).toBe(200);
  expect(page.text).toContain('Me désinscrire');
  expect(page.text).toContain('contact@example.com');

  const done = await request.post(`/unsub/fr/${key}/${obj}`).type('form').send({ unsub: '1' });
  expect(done.status).toBe(200);
  expect(done.text).toContain('bien été prise en compte');
  const events = await models().ActionQueue.findAll({ where: { type: 'insert_contact_event' } });
  expect(events.length).toBe(1);
  expect(events[0].payload.eventType).toBe('unsub');
  expect(events[0].payload.messageId).toBe('msg-1');
  await models().ActionQueue.destroy({ where: {} });
});

test('webhook toolso : une livraison devient une action insert_contact_event', async () => {
  const body = {
    eventType: 'Delivery',
    mail: { to: 'contact@example.com', timestamp: Date.now(), messageId: 'msg-1' },
    delivery: { timestamp: Date.now(), ip: '1.2.3.4' }
  };
  const res = await request.post('/webhooks/toolso').set('content-type', 'application/json').send(JSON.stringify(body));
  expect(res.status).toBe(200);
  const alias = await request.post('/toolso').set('content-type', 'text/plain').send(JSON.stringify(body));
  expect(alias.status).toBe(200);
  const events = await models().ActionQueue.findAll({ where: { type: 'insert_contact_event' } });
  expect(events.length).toBe(2);
  expect(events[0].payload.eventType).toBe('delivered');
  expect(events[0].payload.ip).toBe('1.2.3.4');
  await models().ActionQueue.destroy({ where: {} });
});

test("file d'actions : paquets, réservation concurrente, échec et reprise", async () => {
  const ActionService = require('../../src/services/ActionService');
  const actionService = new ActionService();
  await actionService.newActionsWithPackage(
    'update_contact_status',
    Array.from({ length: 250 }, (_, i) => ({ contactId: i + 1 }))
  );
  const packages = await models().ActionQueue.findAll({ where: { type: 'package_action' } });
  expect(packages.length).toBe(3);
  expect(packages[0].payload.payloads.length).toBe(100);

  const first = await actionService.claim('default', 2);
  const second = await actionService.claim('default', 2);
  expect(first.length).toBe(2);
  expect(second.length).toBe(1);
  expect(new Set([...first, ...second].map((action) => action.id)).size).toBe(3);

  await actionService.fail(first[0], new Error('boom'));
  const failed = await models().ActionQueue.findByPk(first[0].id);
  expect(failed.status).toBe('pending');
  expect(failed.lastError).toContain('boom');
  expect(failed.availableAt.getTime()).toBeGreaterThan(Date.now());

  // paquet exécuté : 100 actions unitaires créées
  const { executeAction } = require('../../src/queue/executeAction');
  await executeAction(first[1]);
  await actionService.complete(first[1].id);
  expect(await models().ActionQueue.count({ where: { type: 'update_contact_status' } })).toBe(100);

  // action « huge » dans sa propre file
  await actionService.newAction('export_contacts', { fields: ['email'] }, true);
  expect((await actionService.claim('huge', 5)).length).toBe(1);
  await models().ActionQueue.destroy({ where: {} });
});

test('scheduler : le verrou PostgreSQL empêche deux exécutions simultanées du même job', async () => {
  const { runWithLock, loadSchedules } = require('../../src/entrypoints/scheduler');
  const schedules = loadSchedules();
  expect(schedules.find((schedule) => schedule.job === 'check_schedules_to_send').cron).toBe('* * * * *');
  expect(schedules.find((schedule) => schedule.job === 'update_contents_scores')).toBeUndefined();
  expect(schedules.find((schedule) => schedule.job === '_comment')).toBeUndefined();
  expect(schedules.length).toBe(20);

  const runJob = require('../../src/jobs/runJob');
  const original = runJob.runJob;
  let running = 0;
  let maxRunning = 0;
  runJob.runJob = async () => {
    running++;
    maxRunning = Math.max(maxRunning, running);
    await new Promise((resolve) => setTimeout(resolve, 300));
    running--;
  };
  try {
    const results = await Promise.all([runWithLock('database_cleaner'), runWithLock('database_cleaner')]);
    expect(results.sort()).toEqual([false, true]);
    expect(maxRunning).toBe(1);
  } finally {
    runJob.runJob = original;
  }
});

test('database_cleaner purge les miroirs expirés et les fichiers anciens', async () => {
  const MirrorService = require('../../src/services/MirrorService');
  await models().Mirror.create({ mirrorId: '99999999-2222-4333-8444-555555555555', messageId: 'old', to: 'x', expDate: new Date(Date.now() - 1000) });
  expect(await new MirrorService().purgeExpired()).toBe(1);
  expect(await models().Mirror.count()).toBe(2);

  const { storeFile, purgeOldFiles, Folders } = require('../../src/services/FileStorageService');
  const stored = await storeFile('export_old.csv', 'a;b', Folders.exports, 'public-read');
  expect(stored.Location).toBe('https://emailing.example.com/files/test/exports/export_old.csv');
  const target = path.join(filesDir, 'exports', 'export_old.csv');
  const old = new Date(Date.now() - 40 * 24 * 3600 * 1000);
  fs.utimesSync(target, old, old);
  expect(await purgeOldFiles()).toBe(1);
  expect(fs.existsSync(target)).toBe(false);
});
