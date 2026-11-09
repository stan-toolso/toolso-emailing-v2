const sequelize = require('../storage/sequelize');
const log = require('../util/log').getLogger('BlacklistedContactService');
const { Op } = require('sequelize');
const ContactService = require('./ContactService');

var md5Fc = require('md5');
var sha1Fc = require('sha1');
var sha256Fc = require('js-sha256');
const { appendStats } = require('./utils/StatsUtils');

module.exports = class {
  constructor() {
    this.BlacklistedContact = sequelize.get().models.BlacklistedContact;
    this.contactService = new ContactService();
  }

  findWithId = async (id) => {
    return await this.BlacklistedContact.findByPk(id);
  };

  findAll = async (offset = 0, limit = 100, filter = {}) => {
    let where = this._buildWhereFromFilter(filter);

    return await this.BlacklistedContact.findAll({
      where,
      order: [['id', 'DESC']],
      offset,
      limit
    });
  };

  countAll = async (filter) => {
    let where = this._buildWhereFromFilter(filter);
    return await this.BlacklistedContact.count({
      where: Object.keys(where).length > 0 ? where : null
    });
  };

  _buildWhereFromFilter = (filter) => {
    let where = {};
    if (filter) {
      if ('email' in filter && filter.email) {
        let email = filter['email'].toLowerCase().trim();
        where[Op.or] = [{ email: { [Op.iLike]: `%${email}%` } }, { md5: md5Fc(email) }, { sha1: sha1Fc(email) }, { sha256: sha256Fc(email) }];
      }
      if ('md5' in filter && filter.md5) {
        where['md5'] = {
          [Op.iLike]: `%${filter['md5']}%`
        };
      }
      if ('sha1' in filter && filter.sha1) {
        where['sha1'] = {
          [Op.iLike]: `%${filter['sha1']}%`
        };
      }
      if ('sha256' in filter && filter.sha256) {
        where['sha256'] = {
          [Op.iLike]: `%${filter['sha256']}%`
        };
      }
    }
    return where;
  };

  findWithFields = async (email, md5, sha1, sha256) => {
    let or = [];
    if (email) {
      email = email.toLowerCase().trim();
      or.push({ email });
    }
    if (md5) {
      md5 = md5.toLowerCase().trim();
    } else if (email) {
      md5 = md5Fc(email);
    }
    if (md5) {
      or.push({ md5 });
    }
    if (sha1) {
      sha1 = sha1.toLowerCase().trim();
    } else if (email) {
      sha1 = sha1Fc(email);
    }
    if (sha1) {
      or.push({ sha1 });
    }
    if (sha256) {
      sha256 = sha256.toLowerCase().trim();
    } else if (email) {
      sha256 = sha256Fc(email);
    }
    if (sha256) {
      or.push({ sha256 });
    }
    if (or.length === 0) {
      return null;
    }

    return await this.BlacklistedContact.findOne({
      where: {
        [Op.or]: or
      }
    });
  };
  blacklistContactWithId = async (id, origin, reason) => {
    let contact = await this.contactService.findWithId(id);
    if (contact && !contact.blacklisted) {
      await this.blacklistContact(contact.email, contact.md5, contact.sha1, contact.sha256, contact.stats, origin, reason);

      let ContactStatusService = require('./ContactStatusService');
      await new ContactStatusService().updateContactStatus(contact);

      return contact;
    }
    return contact;
  };

  blacklistContact = async (email, md5, sha1, sha256, stats, origin, reason) => {
    if (email) {
      email = email.toLowerCase().trim();
    }
    if (md5) {
      md5 = md5.toLowerCase().trim();
    } else if (email) {
      md5 = md5Fc(email);
    }
    if (sha1) {
      sha1 = sha1.toLowerCase().trim();
    } else if (email) {
      sha1 = sha1Fc(email);
    }
    if (sha256) {
      sha256 = sha256.toLowerCase().trim();
    } else if (email) {
      sha256 = sha256Fc(email);
    }
    if (!stats && email) {
      let contact = await this.contactService.findWithEmail(email);
      if (contact) {
        stats = contact.stats;
      }
    }

    let existingContact = await this.findWithFields(email, md5, sha1, sha256);
    if (existingContact) {
      if (!existingContact.stats) {
        existingContact.stats = {};
      }
      if (!existingContact.history) {
        existingContact.history = {
          blacklists: []
        };
      }
      if (!existingContact.history.blacklists) {
        existingContact.history.blacklists = [];
      }
      existingContact.stats = appendStats(existingContact.stats, stats ? stats : {});
      existingContact.history.blacklists.push({
        origin,
        reason,
        date: new Date()
      });

      existingContact.changed('stats', true);
      existingContact.changed('history', true);
      await existingContact.save();
      return existingContact;
    } else {
      return await this.BlacklistedContact.create({
        email: email ? email : null,
        md5: md5 ? md5 : null,
        sha1: sha1 ? sha1 : null,
        sha256: sha256 ? sha256 : null,
        stats,
        history: {
          blacklists: [
            {
              origin,
              reason,
              date: new Date()
            }
          ]
        }
      });
    }
  };

  unblacklistContactWithId = async (id) => {
    let contact = await this.contactService.findWithId(id);
    if (contact) {
      await this.deleteWithFields(contact.email, contact.md5, contact.sha1, contact.sha256);

      let ContactStatusService = require('./ContactStatusService');
      await new ContactStatusService().updateContactStatus(contact);
    }
  };

  delete = async (id) => {
    let item = await this.BlacklistedContact.findByPk(id);
    if (item) {
      await item.destroy();
    }
  };

  deleteWithFields = async (email, md5, sha1, sha256) => {
    let item = await this.findWithFields(email, md5, sha1, sha256);
    if (item) {
      await item.destroy();
    }
  };
};
