const { Op } = require('sequelize');
const sequelize = require('../storage/sequelize');
const { mergeFieldsInObject } = require('./utils/DatabaseUtils');

module.exports = class {
  constructor() {
    this.Sender = sequelize.get()?.models?.Sender;
    this.MailRouter = sequelize.get()?.models?.MailRouter;
    this.cacheById = {};
  }

  findWithIdInCache = async (id) => {
    if (!(id in this.cacheById)) {
      this.cacheById[id] = await this.findWithId(id);
    }
    return this.cacheById[id];
  };

  findWithId = async (id) => {
    return await this.Sender.findByPk(id, {
      include: {
        model: this.MailRouter,
        as: 'mailRouter'
      }
    });
  };

  findAll = async (filter) => {
    let where = this._buildWhereFromFilter(filter);

    return await this.Sender.findAll({
      where: Object.keys(where).length > 0 ? where : null,
      order: [['id', 'DESC']]
    });
  };
  _buildWhereFromFilter(filter) {
    let where = {
      [Op.or]: [
        {
          deleted: {
            [Op.ne]: false
          }
        },
        {
          deleted: {
            [Op.is]: null
          }
        }
      ]
    };

    if (filter) {
      if ('name' in filter) {
        where['name'] = {
          [Op.iLike]: `%${filter['name']}%`
        };
      }
      if ('email' in filter) {
        where['email'] = {
          [Op.iLike]: `%${filter['email']}%`
        };
      }
    }
    return where;
  }

  createWithName = async (name) => {
    return await this.Sender.create({
      name: name ? name : 'New Sender'
    });
  };

  update = async (sender) => {
    let storedSender = await this.Sender.findByPk(sender.id);
    if (storedSender) {
      mergeFieldsInObject(['name', 'senderName', 'replyToName', 'replyToEmail', 'unsubscribeMailto', 'trackingDomain', 'deleted'], sender, storedSender);
      if (!storedSender.hasSentSomething) {
        mergeFieldsInObject(['email'], sender, storedSender);
      }
      if (!storedSender.hasSentSomething || !storedSender.mailRouterId) {
        mergeFieldsInObject(['mailRouterId'], sender, storedSender);
      }
      await storedSender.save();
    }
    return storedSender;
  };

  markAsDeleted = async (id) => {
    let originalSender = await this.Sender.findByPk(id);
    if (originalSender) {
      originalSender.deleted = true;
      await originalSender.save();
    }
    return originalSender;
  };
};
