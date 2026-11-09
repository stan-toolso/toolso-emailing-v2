const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const readline = require('readline');
const log = require('../util/log').getLogger('DynamoMirror');

/**
 * Conversion des miroirs v1 (DynamoDB `toolso-emailing-mirrors` + S3 `toolso-emailing-mirror-body`) vers la table `Mirror`.
 *
 * Format v1 (ContentSender.sendMessage d'origine) :
 *   Item = { mirrorId:{S}, messageId:{S}, ResourceUid:{S}, To:{S}, Subject:{S}, Source:{S}, CompressedBody:{B}, ExpDate:{N, epoch s} }
 *   CompressedBody = `zlib.deflateSync(html).toString('base64')` passé tel quel à l'attribut binaire : l'octet stocké est donc
 *   le TEXTE base64 du deflate, que le CLI / SDK renvoie encodé une seconde fois en base64. Au-delà de 990 octets, l'attribut est
 *   retiré de l'item et le même texte base64 est écrit dans S3 sous la clé `mirrorId` (seulement si le mail contient le lien miroir).
 *
 * Les fichiers lus sont ceux produits par `aws dynamodb scan --output json` (`{ "Items": [...] }`), ou du NDJSON (un item par
 * ligne, nu ou enveloppé `{ "Item": {...} }` comme l'export S3 de DynamoDB), éventuellement gzippés (`.gz`).
 */

const RETENTION_DAYS = 30;
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const BASE64_TEXT_RE = /^[A-Za-z0-9+/]+={0,2}$/;
const DEFAULT_BATCH_SIZE = 500;

const isZlibStream = (bytes) => {
  if (!bytes || bytes.length < 2 || bytes[0] !== 0x78) {
    return false;
  }
  try {
    zlib.inflateSync(bytes);
    return true;
  } catch (_) {
    return false;
  }
};

const normalizeDeflate = (bytes, depth = 0) => {
  if (!bytes || bytes.length === 0) {
    return null;
  }
  if (isZlibStream(bytes)) {
    return bytes;
  }
  if (depth < 2) {
    const text = bytes.toString('latin1').replace(/\s+/g, '');
    if (text.length > 0 && BASE64_TEXT_RE.test(text)) {
      return normalizeDeflate(Buffer.from(text, 'base64'), depth + 1);
    }
  }
  return null;
};

/**
 * Ramène un corps compressé v1 à un flux zlib deflate brut (celui attendu par `MirrorService.getBody`).
 * @param {Buffer|string|{B?: string, S?: string}|null} value attribut DynamoDB JSON (`{B}` base64 du CLI, ou `{S}`),
 *   contenu d'un objet S3 (texte base64) ou Buffer quelconque
 * @returns {Buffer|null} null si vide ou indéchiffrable
 */
const decodeCompressedBody = (value) => {
  if (value === null || value === undefined) {
    return null;
  }
  let bytes;
  if (Buffer.isBuffer(value)) {
    bytes = value;
  } else if (typeof value === 'string') {
    bytes = Buffer.from(value, 'utf8');
  } else if (typeof value === 'object') {
    if (value.B !== undefined && value.B !== null) {
      bytes = Buffer.isBuffer(value.B) ? value.B : Buffer.from(String(value.B), 'base64');
    } else if (value.S !== undefined && value.S !== null) {
      bytes = Buffer.from(String(value.S), 'utf8');
    } else {
      return null;
    }
  } else {
    return null;
  }
  return normalizeDeflate(bytes);
};

const attr = (item, name) => {
  const value = item ? item[name] : undefined;
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'object') {
    return value;
  }
  if (value.S !== undefined) return value.S;
  if (value.N !== undefined) return value.N;
  if (value.NULL) return null;
  return null;
};

const truncate = (value, max) => (typeof value === 'string' && value.length > max ? value.slice(0, max) : value);

/**
 * Convertit un item DynamoDB (format JSON DynamoDB) en ligne de la table `Mirror`.
 * @returns {{ row: object, resourceUid: string|null, hasInlineBody: boolean } | { error: string }}
 */
const convertItem = (item) => {
  const mirrorId = attr(item, 'mirrorId');
  if (!mirrorId || !UUID_RE.test(mirrorId)) {
    return { error: `mirrorId invalide : ${mirrorId}` };
  }
  const expSeconds = Number(attr(item, 'ExpDate'));
  const expDate = Number.isFinite(expSeconds) && expSeconds > 0 ? new Date(expSeconds * 1000) : new Date(Date.now() + RETENTION_DAYS * 24 * 3600 * 1000);
  const compressedBody = decodeCompressedBody(item.CompressedBody);
  return {
    resourceUid: attr(item, 'ResourceUid'),
    hasInlineBody: compressedBody !== null,
    row: {
      mirrorId: mirrorId.toLowerCase(),
      messageId: truncate(attr(item, 'messageId'), 255),
      to: truncate(attr(item, 'To'), 255),
      subject: attr(item, 'Subject'),
      source: truncate(attr(item, 'Source'), 255),
      compressedBody,
      expDate
    }
  };
};

/** Lit un fichier d'export (JSON du CLI ou NDJSON, .gz accepté) et renvoie ses items DynamoDB. */
const readExportFile = async (file) => {
  const gz = file.endsWith('.gz');
  const open = () => (gz ? fs.createReadStream(file).pipe(zlib.createGunzip()) : fs.createReadStream(file));
  const first = await new Promise((resolve, reject) => {
    const stream = open();
    stream.once('error', reject);
    stream.once('data', (chunk) => {
      stream.destroy();
      resolve(chunk.toString('utf8', 0, Math.min(chunk.length, 64)).trimStart());
    });
    stream.once('end', () => resolve(''));
  });
  if (first.startsWith('{"Items"') || first.startsWith('{ "Items"') || /^\{\s*\n?\s*"(Items|Count|ScannedCount|NextToken|ConsumedCapacity)"/.test(first)) {
    const content = await new Promise((resolve, reject) => {
      const chunks = [];
      open()
        .on('data', (c) => chunks.push(c))
        .on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
        .on('error', reject);
    });
    const parsed = JSON.parse(content);
    return Array.isArray(parsed.Items) ? parsed.Items : [];
  }
  // NDJSON : un item par ligne, nu ou { "Item": {...} }
  const items = [];
  const rl = readline.createInterface({ input: open(), crlfDelay: Infinity });
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parsed = JSON.parse(trimmed);
    items.push(parsed.Item ? parsed.Item : parsed);
  }
  return items;
};

const listExportFiles = (dir) =>
  fs
    .readdirSync(dir)
    .filter((name) => /\.(json|ndjson|jsonl)(\.gz)?$/.test(name))
    .sort()
    .map((name) => path.join(dir, name));

/**
 * Importe les miroirs d'un dossier d'export dans la table `Mirror` (upsert : relançable sans doublon).
 * @param {object} options
 * @param {import('sequelize').Sequelize} options.sequelize connexion initialisée (modèle `Mirror` défini)
 * @param {string} options.dir dossier des fichiers d'export
 * @param {string} [options.bodiesDir] dossier des objets S3 téléchargés (`<bodiesDir>/<mirrorId>`) pour les corps absents de l'item
 * @param {string} [options.resourceUid] n'importe que les items de cette base (sécurité si l'export n'était pas filtré)
 * @param {boolean} [options.includeExpired=false] importe aussi les miroirs déjà expirés (sinon ignorés)
 * @param {number} [options.batchSize=500]
 * @param {number} [options.now=Date.now()]
 */
const importMirrors = async ({ sequelize, dir, bodiesDir, resourceUid, includeExpired = false, batchSize = DEFAULT_BATCH_SIZE, now = Date.now() }) => {
  const Mirror = sequelize.models.Mirror;
  if (!Mirror) {
    throw new Error('Mirror model is not defined on this sequelize instance');
  }
  const stats = { files: 0, items: 0, imported: 0, skippedExpired: 0, skippedOtherUid: 0, invalid: 0, bodiesInline: 0, bodiesFromFiles: 0, bodiesMissing: 0 };
  const files = listExportFiles(dir);
  const readBodyFile = (mirrorId) => {
    if (!bodiesDir) return null;
    const file = path.join(bodiesDir, mirrorId);
    if (!fs.existsSync(file)) return null;
    return decodeCompressedBody(fs.readFileSync(file));
  };
  const flush = async (rows) => {
    if (rows.length === 0) return;
    await Mirror.bulkCreate(rows, { updateOnDuplicate: ['messageId', 'to', 'subject', 'source', 'compressedBody', 'expDate', 'updatedAt'] });
    stats.imported += rows.length;
  };

  for (const file of files) {
    stats.files += 1;
    const items = await readExportFile(file);
    let rows = [];
    for (const item of items) {
      stats.items += 1;
      const converted = convertItem(item);
      if (converted.error) {
        stats.invalid += 1;
        log.warn(`${path.basename(file)} : item ignoré (${converted.error})`);
        continue;
      }
      if (resourceUid && converted.resourceUid && converted.resourceUid !== resourceUid) {
        stats.skippedOtherUid += 1;
        continue;
      }
      if (!includeExpired && converted.row.expDate.getTime() <= now) {
        stats.skippedExpired += 1;
        continue;
      }
      if (converted.hasInlineBody) {
        stats.bodiesInline += 1;
      } else {
        const body = readBodyFile(converted.row.mirrorId);
        if (body) {
          converted.row.compressedBody = body;
          stats.bodiesFromFiles += 1;
        } else {
          stats.bodiesMissing += 1;
        }
      }
      rows.push(converted.row);
      if (rows.length >= batchSize) {
        await flush(rows);
        rows = [];
      }
    }
    await flush(rows);
    log.info(`${path.basename(file)} : ${items.length} items lus, ${stats.imported} miroirs importés au total`);
  }
  return stats;
};

module.exports = { decodeCompressedBody, convertItem, readExportFile, listExportFiles, importMirrors, RETENTION_DAYS };
