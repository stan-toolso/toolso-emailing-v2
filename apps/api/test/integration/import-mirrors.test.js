/**
 * Import des miroirs v1 (export DynamoDB + corps S3) dans la table `Mirror`, sur PostgreSQL embarqué :
 * formats de fichiers, filtres (uid, expiration), corps depuis le dossier S3, idempotence, lecture par MirrorService.
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const zlib = require('zlib');
const { startEmbeddedPostgres } = require('../lib/embedded-pg');

jest.setTimeout(180000);

const ROOT = path.join(__dirname, '..', '..');
let pg;
let sequelizeModule;
let workDir;

const html = (n) => `<html><body><h1>Message ${n}</h1></body></html>`;
const v1Base64 = (n) => zlib.deflateSync(Buffer.from(html(n), 'utf8')).toString('base64');
const cliBinary = (text) => Buffer.from(text, 'utf8').toString('base64');
const uuid = (n) => `${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`;
const item = (n, { uid = 'test', body = true, expOffsetDays = 20 } = {}) => ({
  mirrorId: { S: uuid(n) },
  messageId: { S: `msg-${n}` },
  ResourceUid: { S: uid },
  To: { S: `c${n}@example.com` },
  Subject: { S: `Sujet ${n}` },
  Source: { S: 'Exp <no-reply@example.com>' },
  ...(body ? { CompressedBody: { B: cliBinary(v1Base64(n)) } } : {}),
  ExpDate: { N: String(Math.round(Date.now() / 1000) + expOffsetDays * 24 * 3600) }
});

beforeAll(async () => {
  const databaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emailing-pg-'));
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emailing-mirrors-'));
  pg = await startEmbeddedPostgres({ databaseDir, persistent: false, quiet: true });
  Object.assign(process.env, { RESOURCE_UID: 'test', DATABASE_URL: pg.databaseUrl(), JWT_SECRET: 'test-secret', LOG_LEVEL: 'WARN' });
  process.chdir(ROOT);
  sequelizeModule = require('../../src/storage/sequelize');
  const sequelize = await sequelizeModule.initWithPostgresql(5);
  await sequelize.models.Mirror.sync({ force: true });
});

afterAll(async () => {
  await sequelizeModule.close();
  await pg.stop();
});

test('import depuis les pages du CLI, un fichier NDJSON gzippé et des corps S3 ; filtres uid et expiration', async () => {
  const pages = path.join(workDir, 'pages');
  const bodies = path.join(workDir, 'bodies');
  fs.mkdirSync(pages);
  fs.mkdirSync(bodies);
  // page 1 : deux items complets, un item d'une autre base, un item expiré
  fs.writeFileSync(path.join(pages, 'page-0-0001.json'), JSON.stringify({ Items: [item(1), item(2), item(3, { uid: 'autre' }), item(4, { expOffsetDays: -1 })], Count: 4, ScannedCount: 4 }));
  // page 2 : item sans corps inline dont le corps est dans S3, item sans corps nulle part (mail sans lien miroir)
  fs.writeFileSync(path.join(pages, 'page-0-0002.json'), JSON.stringify({ Items: [item(5, { body: false }), item(6, { body: false })] }));
  fs.writeFileSync(path.join(bodies, uuid(5)), v1Base64(5));
  // export NDJSON gzippé (format de l'export S3 de DynamoDB)
  fs.writeFileSync(path.join(pages, 'export.json.gz'), zlib.gzipSync([JSON.stringify({ Item: item(7) }), JSON.stringify(item(8))].join('\n') + '\n'));
  // fichier ignoré (pas une extension connue)
  fs.writeFileSync(path.join(pages, 'notes.txt'), 'x');

  const { importMirrors } = require('../../src/migration/dynamoMirror');
  const sequelize = sequelizeModule.get();
  const stats = await importMirrors({ sequelize, dir: pages, bodiesDir: bodies, resourceUid: 'test', batchSize: 3 });
  expect(stats).toMatchObject({ files: 3, items: 8, imported: 6, skippedExpired: 1, skippedOtherUid: 1, invalid: 0, bodiesInline: 4, bodiesFromFiles: 1, bodiesMissing: 1 });
  expect(await sequelize.models.Mirror.count()).toBe(6);

  const MirrorService = require('../../src/services/MirrorService');
  const service = new MirrorService();
  expect(await service.getBody(uuid(1))).toBe(html(1));
  expect(await service.getBody(uuid(5))).toBe(html(5));
  expect(await service.getBody(uuid(6))).toBeNull();
  expect(await service.getMessageId(uuid(6))).toBe('msg-6');
  expect(await service.getMessageId(uuid(8))).toBe('msg-8');
  expect(await service.find(uuid(3))).toBeNull();
  expect(await service.find(uuid(4))).toBeNull();

  // idempotence : un second import ne crée rien et met à jour les lignes existantes
  const again = await importMirrors({ sequelize, dir: pages, bodiesDir: bodies, resourceUid: 'test' });
  expect(again.imported).toBe(6);
  expect(await sequelize.models.Mirror.count()).toBe(6);

  // les miroirs expirés peuvent être importés sur demande, et sont alors purgés comme les autres
  const withExpired = await importMirrors({ sequelize, dir: pages, bodiesDir: bodies, resourceUid: 'test', includeExpired: true });
  expect(withExpired.skippedExpired).toBe(0);
  expect(await sequelize.models.Mirror.count()).toBe(7);
  expect(await service.purgeExpired()).toBe(1);
  expect(await sequelize.models.Mirror.count()).toBe(6);
});

test('un item sans mirrorId valide est ignoré sans interrompre l’import', async () => {
  const dir = path.join(workDir, 'invalid');
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, 'page.json'), JSON.stringify({ Items: [{ mirrorId: { S: 'oops' } }, item(9)] }));
  const { importMirrors } = require('../../src/migration/dynamoMirror');
  const stats = await importMirrors({ sequelize: sequelizeModule.get(), dir, resourceUid: 'test' });
  expect(stats).toMatchObject({ items: 2, imported: 1, invalid: 1 });
});
