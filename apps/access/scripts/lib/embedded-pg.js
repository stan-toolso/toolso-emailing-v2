// Démarre un PostgreSQL embarqué (paquet embedded-postgres, devDependency) pour le développement et les tests.
const net = require('net');
const path = require('path');
const fs = require('fs');

const freePort = () =>
  new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });

const USER = 'access';
const PASSWORD = 'access';

/**
 * @param {{ databaseDir: string, port?: number, persistent?: boolean, databases?: string[], quiet?: boolean }} options
 * @returns {Promise<{ port: number, databaseUrl: (db: string) => string, stop: () => Promise<void> }>}
 */
const startEmbeddedPostgres = async ({ databaseDir, port, persistent = true, databases = ['access'], quiet = false }) => {
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  port = port || (await freePort());
  const alreadyInitialised = fs.existsSync(path.join(databaseDir, 'PG_VERSION'));

  const pg = new EmbeddedPostgres({
    databaseDir,
    port,
    user: USER,
    password: PASSWORD,
    persistent,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    onLog: quiet ? () => {} : (m) => process.stdout.write(String(m)),
    onError: quiet ? () => {} : (m) => process.stderr.write(String(m))
  });

  if (!alreadyInitialised) {
    await pg.initialise();
  }
  await pg.start();

  const client = pg.getPgClient('postgres');
  await client.connect();
  try {
    for (const db of databases) {
      const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [db]);
      if (exists.rowCount === 0) {
        await client.query(`CREATE DATABASE "${db}"`);
      }
    }
  } finally {
    await client.end();
  }

  return {
    port,
    databaseUrl: (db = 'access') => `postgres://${USER}:${PASSWORD}@127.0.0.1:${port}/${db}`,
    stop: () => pg.stop()
  };
};

module.exports = { startEmbeddedPostgres, freePort };
