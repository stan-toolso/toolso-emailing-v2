const log = require('../util/log').getLogger('BatService');
const config = require('../util/config');

const sequelize = require('../storage/sequelize');
const { v4: uuidv4 } = require('uuid');
const BatStatus = require('../storage/models/BatStatus');
const ContentSender = require('../services/ContentSender');
const ContentService = require('../services/ContentService');
const { mergeFieldsInObject } = require('./utils/DatabaseUtils');
const { sendEmail } = require('./ToolsoEmailService');
const { getCachedSettings } = require('./SettingsService');
const moment = require('moment-timezone');
const { Op } = require('sequelize');

module.exports = class {
  constructor() {
    this.Bat = sequelize.get().models.Bat;
    this.Content = sequelize.get().models.Content;
    this.contentSender = new ContentSender();
    this.contentService = new ContentService();
  }

  findWithId = async (id) => {
    return await this.Bat.findByPk(id);
  };

  findWithUid = async (uid) => {
    return await this.Bat.findOne({ where: { uid } });
  };

  findAll = async (offset = 0, limit = 100, filter = {}) => {
    let where = await this._buildWhereFromFilter(filter);
    return await this.Bat.findAll({
      where,
      order: [['id', 'DESC']],
      offset,
      limit,
      include: filter.contentName
        ? [
            {
              model: this.Content,
              as: 'content',
              required: false || filter.contentName
            }
          ]
        : []
    });
  };

  countAll = async (filter) => {
    let where = await this._buildWhereFromFilter(filter);
    return await this.Bat.count({
      where: Object.keys(where).length > 0 ? where : null,
      include: filter.contentName
        ? [
            {
              model: this.Content,
              as: 'content',
              required: false || filter.contentName
            }
          ]
        : []
    });
  };

  _buildWhereFromFilter = async (filter) => {
    let where = {};
    if (filter) {
      if ('partnerId' in filter && filter.partnerId) {
        where['partnerId'] = filter.partnerId;
      }

      if ('validatorEmails' in filter && filter.validatorEmails) {
        where['validatorEmails'] = {
          [Op.iLike]: `%${filter['validatorEmails']}%`
        };
      }
      if ('contentName' in filter && filter.contentName) {
        where['$content.name$'] = {
          [Op.iLike]: `%${filter['contentName']}%`
        };
      }
      if ('status' in filter && filter.status) {
        where['status'] = filter.status;
      }
      if ('fromDate' in filter) {
        where['date'] = {
          [Op.gte]: moment.tz(filter.fromDate, 'YYYY-MM-DD', (await getCachedSettings(['timezone'])).timezone).toDate()
        };
      }
      if ('toDate' in filter) {
        where['date'] = {
          ...(where['date'] ? where['date'] : {}),
          [Op.lte]: moment
            .tz(filter.toDate, 'YYYY-MM-DD', (await getCachedSettings(['timezone'])).timezone)
            .endOf('day')
            .toDate()
        };
      }
    }

    return where;
  };

  createBat = async (contentId, author) => {
    log.debug(`Create new BAT for content ${contentId}`);

    let bat = this.Bat.build({
      contentId,
      author,
      status: BatStatus.draft,
      uid: uuidv4(),
      date: new Date()
    });

    await bat.save();

    return bat;
  };
  updateBat = async (bat) => {
    let storedBat = await this.Bat.findByPk(bat.id);
    if (storedBat) {
      mergeFieldsInObject(['status', 'validatorsEmails', 'validations', 'comments', 'author', 'message', 'sendingConfigId', 'partnerId'], bat, storedBat);
      if (!storedBat.sendingConfigId) {
        storedBat.sendingConfigId = null;
      }
      if (!storedBat.partnerId) {
        storedBat.partnerId = null;
      }
      await storedBat.save();
    }
    return storedBat;
  };

  sendBat = async (batId, versionId, replyTo = null) => {
    let storedBat = await this.Bat.findByPk(batId);
    if (storedBat && storedBat.status != BatStatus.validated && storedBat.status != BatStatus.rejected) {
      storedBat.status = BatStatus.waiting;

      await storedBat.save();
      let content = await storedBat.getContent();
      let versions = await content.getVersions();
      versions = versions.filter((version) => {
        return this.contentService.isVersionAvailable(version);
      });
      let validations = storedBat.validations ? storedBat.validations : {};
      for (let version of versions) {
        if (versionId && version.id != versionId) {
          continue;
        }
        if (!(version.id in validations)) {
          validations[version.id] = {
            lastSendbatDate: new Date(),
            versionId: version.id,
            versionName: version.name,
            status: BatStatus.waiting,
            sendingHistory: [],
            emails: {}
          };
        }
        validations[version.id].status = BatStatus.waiting;
        validations[version.id].lastSendbatDate = new Date();

        let results = await this.contentSender.sendBat(storedBat, content, version, versions.length > 1, replyTo);
        for (let result of results) {
          if (result.html && result.email) {
            if (!(result.email in validations[version.id].emails)) {
              validations[version.id].emails[result.email] = {};
            }
            validations[version.id].emails[result.email].mirrorLink = result.mirrorLink;
            validations[version.id].emails[result.email].html = result.html;
            validations[version.id].emails[result.email].subject = result.subject;
            validations[version.id].emails[result.email].senderName = result.senderName;
          }
        }

        validations[version.id].sendingHistory.push(results);
      }
      storedBat.validations = validations;

      storedBat.changed('validations', true);
      await storedBat.save();
    }
    return storedBat;
  };

  validate = async (bat, content, version, ip, userAgent, comment, validator) => {
    log.debug(`Validate BAT ${bat.id}, Content ${content.id} Version ${version.id}. IP : ${ip}. Email : ${validator}`);

    let versions = await content.getVersions();
    versions = versions.filter((version) => {
      return this.contentService.isVersionAvailable(version);
    });

    let allValidated = true;
    let validations = bat.validations;

    let validation = null;
    let emailObject = null;

    for (let versionItem of versions) {
      if (!(versionItem.id in validations)) {
        validations[versionItem.id] = {
          lastSendbatDate: new Date(),
          versionId: versionItem.id,
          versionName: versionItem.name,
          status: BatStatus.waiting,
          sendingHistory: []
        };
      }

      if (version.id == versionItem.id) {
        validations[versionItem.id].status = BatStatus.validated;
        validations[versionItem.id].ip = ip;
        validations[versionItem.id].userAgent = userAgent;
        validations[versionItem.id].comment = comment;
        validations[versionItem.id].validator = validator;

        validation = validations[versionItem.id];
        emailObject = validation.emails[validations[versionItem.id].validator];
      }

      allValidated = allValidated && validations[versionItem.id].status == BatStatus.validated;
    }
    await sendEmail(
      'batVersionValidated',
      '[BAT][Validated]-' + content.name,
      {
        validator,
        bat,
        content,
        version,
        comment,
        batLink: `${config.publicUrl()}/#/${process.env.RESOURCE_UID}/contents/list/${content.id}/bats`
      },
      [bat.author]
    );

    if (validation) {
      let versions = await content.getVersions();
      versions = versions.filter((version) => {
        return this.contentService.isVersionAvailable(version);
      });

      await this.contentSender.sendBat(bat, content, version, versions.length > 1, null, validation);
    }

    if (allValidated) {
      bat.status = BatStatus.validated;
    }

    bat.changed('validations', true);
    await bat.save();
  };

  reject = async (bat, content, version, ip, userAgent, comment, validator) => {
    log.debug(`Reject BAT ${bat.id}, Content ${content.id} Version ${version.id}. IP : ${ip}`);

    let versions = await content.getVersions();
    versions = versions.filter((version) => {
      return this.contentService.isVersionAvailable(version);
    });

    let validations = bat.validations;
    let validation = null;
    let emailObject = null;

    for (let versionItem of versions) {
      if (!(versionItem.id in validations)) {
        validations[versionItem.id] = {
          lastSendbatDate: new Date(),
          versionId: versionItem.id,
          versionName: versionItem.name,
          status: BatStatus.waiting,
          sendingHistory: []
        };
      }

      if (version.id == versionItem.id) {
        validations[versionItem.id].status = BatStatus.rejected;
        validations[versionItem.id].ip = ip;
        validations[versionItem.id].userAgent = userAgent;
        validations[versionItem.id].comment = comment;
        validations[versionItem.id].validator = validator;

        validation = validations[versionItem.id];
        emailObject = validation.emails[validations[versionItem.id].validator];
      }
    }

    await sendEmail(
      'batVersionRejected',
      '[BAT][Rejected]-' + content.name,
      {
        validator,
        bat,
        content,
        version,
        comment,
        validation,
        emailObject,
        batLink: `${config.publicUrl()}/#/${process.env.RESOURCE_UID}/contents/list/${content.id}/bats`
      },
      [bat.author]
    );

    if (validation) {
      let versions = await content.getVersions();
      versions = versions.filter((version) => {
        return this.contentService.isVersionAvailable(version);
      });

      await this.contentSender.sendBat(bat, content, version, versions.length > 1, null, validation);
    }

    bat.changed('validations', true);
    await bat.save();
  };
};
