const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const jwt = require('jsonwebtoken');
const log = require('../util/log').getLogger('FileStorageService');
const config = require('../util/config');

/**
 * Stockage de fichiers sur le disque de l'instance (remplace les buckets S3).
 * - `tmp`     : fichiers CSV envoyés par l'interface (listes d'exclusion / inclusion), privés, purgés après 7 jours
 * - `exports` : exports de contacts envoyés par mail, servis publiquement par nginx sous FILES_PUBLIC_URL/exports/
 */
const Folders = Object.freeze({
  emailing_tmp_files: 'tmp',
  exports: 'exports'
});

const ACL = Object.freeze({
  private: 'private',
  public_read: 'public-read'
});

const RETENTION_DAYS = Object.freeze({
  [Folders.emailing_tmp_files]: 7,
  [Folders.exports]: 30
});

const safeName = (fileName) => {
  const base = path.basename(`${fileName}`).replace(/[^a-zA-Z0-9._-]/g, '_');
  if (!base || base === '.' || base === '..') {
    throw new Error(`Invalid file name ${fileName}`);
  }
  return base;
};

const folderPath = (folder) => path.join(config.filesDir(), folder);

const filePath = (fileName, folder) => path.join(folderPath(folder), safeName(fileName));

const publicUrl = (fileName, folder) => `${config.filesPublicUrl()}/${folder}/${encodeURIComponent(safeName(fileName))}`;

/** Écrit un fichier. Renvoie `{ Location }` (URL publique pour `exports`, chemin local sinon) comme `s3.upload`. */
const storeFile = async (fileName, body, folder = Folders.emailing_tmp_files, acl = ACL.private) => {
  const target = filePath(fileName, folder);
  log.debug(`Store file ${target}`);
  await fsp.mkdir(path.dirname(target), { recursive: true });
  await fsp.writeFile(target, body);
  return {
    Location: acl === ACL.public_read ? publicUrl(fileName, folder) : target,
    Key: safeName(fileName)
  };
};

/** Lit un fichier. Renvoie `{ Body: Buffer }` comme `s3.getObject`, ou null s'il n'existe pas. */
const readFile = async (fileName, folder = Folders.emailing_tmp_files) => {
  const target = filePath(fileName, folder);
  try {
    return { Body: await fsp.readFile(target) };
  } catch (err) {
    log.error(`Failed to read file ${target}`, err);
    return null;
  }
};

const fileExists = (fileName, folder = Folders.emailing_tmp_files) => fs.existsSync(filePath(fileName, folder));

/**
 * URL de dépôt direct (remplace l'URL présignée S3). L'interface fait un `PUT` du fichier sur `signedUrl` ;
 * la route `PUT /uploads/:key` de l'api l'écrit dans `tmp/`. Le jeton (JWT de l'utilisateur, ou un jeton court
 * dédié) est passé en `jwt_token` pour que la route soit authentifiée.
 */
const getUploadUrl = async (fileName, fileType, folder = Folders.emailing_tmp_files, encryptedToken = null) => {
  const key = safeName(fileName);
  const token = encryptedToken ?? jwt.sign({ upload: key }, config.jwtSecret(), { expiresIn: '10m' });
  return {
    s3Key: key,
    signedUrl: `${config.apiPublicUrl()}/uploads/${encodeURIComponent(key)}?jwt_token=${encodeURIComponent(token)}`,
    folder
  };
};

/** Supprime les fichiers plus vieux que leur durée de rétention. */
const purgeOldFiles = async () => {
  let removed = 0;
  for (const folder of Object.values(Folders)) {
    const dir = folderPath(folder);
    if (!fs.existsSync(dir)) {
      continue;
    }
    const limit = Date.now() - (RETENTION_DAYS[folder] ?? 30) * 24 * 3600 * 1000;
    for (const entry of await fsp.readdir(dir)) {
      const target = path.join(dir, entry);
      try {
        const stat = await fsp.stat(target);
        if (stat.isFile() && stat.mtimeMs < limit) {
          await fsp.unlink(target);
          removed++;
        }
      } catch (err) {
        log.warn(`Failed to purge ${target}`, err);
      }
    }
  }
  if (removed > 0) {
    log.info(`${removed} old files purged`);
  }
  return removed;
};

module.exports = {
  Folders,
  // alias historique : le code d'origine parle de « buckets »
  Buckets: Folders,
  ACL,
  storeFile,
  readFile,
  fileExists,
  getUploadUrl,
  purgeOldFiles,
  safeName,
  filePath
};
