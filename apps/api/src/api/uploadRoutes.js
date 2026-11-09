const express = require('express');
const jwt = require('jsonwebtoken');
const log = require('../util/log').getLogger('Uploads');
const { storeFile, Folders, safeName } = require('../services/FileStorageService');
const { getJwtSecret } = require('../services/JwtSecretService');

/**
 * Dépôt direct de fichiers (remplace l'URL présignée S3 utilisée par `react-s3-uploader`) :
 *   PUT /uploads/:key?jwt_token=…   corps = contenu du fichier
 * Le jeton est soit le JWT de l'utilisateur (vérifié par TokenMiddleware), soit un jeton court `{ upload: key }`.
 */
const router = express.Router();

router.put('/uploads/:key', express.raw({ type: () => true, limit: '1gb' }), async (req, res) => {
  try {
    const key = safeName(req.params.key);
    let authorized = !!req.token;
    if (!authorized && req.query.jwt_token) {
      try {
        const payload = jwt.verify(req.query.jwt_token, await getJwtSecret());
        authorized = payload && payload.upload === key;
      } catch (err) {
        authorized = false;
      }
    }
    if (!authorized) {
      res.status(401).json({ status: 'ko', code: 'unauthorized' });
      return;
    }
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from(`${req.body ?? ''}`);
    await storeFile(key, body, Folders.emailing_tmp_files);
    log.info(`File ${key} uploaded (${body.length} bytes)`);
    res.status(200).json({ status: 'ok', key });
  } catch (err) {
    log.error('Upload failed', err);
    res.status(500).json({ status: 'ko' });
  }
});

module.exports = { router };
