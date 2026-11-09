const zlib = require('zlib');
const { Op } = require('sequelize');
const log = require('../util/log').getLogger('MirrorService');
const sequelize = require('../storage/sequelize');

const RETENTION_DAYS = 30;

/**
 * Miroirs des messages envoyés (table `Mirror`), à la place de DynamoDB `toolso-emailing-mirrors` + S3 `toolso-emailing-mirror-body`.
 */
module.exports = class MirrorService {
  get Mirror() {
    return sequelize.get().models.Mirror;
  }

  /**
   * Enregistre le miroir d'un message. Le corps n'est conservé que si le mail contient réellement le lien miroir
   * (`storeBody`), comme en v1 depuis l'optimisation de septembre 2026.
   */
  store = async ({ mirrorId, messageId, to, subject, source, html, storeBody = true }) => {
    const row = {
      mirrorId,
      messageId,
      to,
      subject,
      source,
      compressedBody: storeBody && html ? zlib.deflateSync(Buffer.from(html, 'utf8')) : null,
      expDate: new Date(Date.now() + RETENTION_DAYS * 24 * 3600 * 1000)
    };
    await this.Mirror.upsert(row);
    log.debug(`Mirror ${mirrorId} stored (${row.compressedBody ? row.compressedBody.length : 0} bytes)`);
  };

  find = async (mirrorId) => {
    if (!mirrorId || !/^[0-9a-fA-F-]{36}$/.test(mirrorId)) {
      return null;
    }
    return await this.Mirror.findByPk(mirrorId);
  };

  /** Corps HTML décompressé, ou null. */
  getBody = async (mirrorId) => {
    const mirror = await this.find(mirrorId);
    if (!mirror || !mirror.compressedBody) {
      return null;
    }
    return zlib.inflateSync(Buffer.from(mirror.compressedBody)).toString('utf8');
  };

  getMessageId = async (mirrorId) => {
    const mirror = await this.find(mirrorId);
    return mirror ? mirror.messageId : null;
  };

  /** Purge des miroirs expirés (équivalent du TTL DynamoDB). */
  purgeExpired = async () => {
    const count = await this.Mirror.destroy({ where: { expDate: { [Op.lt]: new Date() } } });
    if (count > 0) {
      log.info(`${count} expired mirrors purged`);
    }
    return count;
  };
};
