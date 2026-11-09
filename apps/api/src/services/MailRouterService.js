const sequelize = require('../storage/sequelize');
const { encryptString } = require('./SettingsService');
const { mergeFieldsInObject } = require('./utils/DatabaseUtils');
const log = require('../util/log').getLogger('MailRouterService');

module.exports = class {
  constructor() {
    this.MailRouter = sequelize.get().models.MailRouter;
  }

  findWithId = async (id) => {
    return await this.MailRouter.findByPk(id);
  };

  findAll = async () => {
    return await this.MailRouter.findAll({});
  };

  createWithName = async (name) => {
    return await this.MailRouter.create({
      name: name ? name : 'New Mail Router'
    });
  };

  update = async (mailRouter) => {
    let storedMailRouter = await this.MailRouter.findByPk(mailRouter.id);
    if (storedMailRouter) {
      if (mailRouter.credentials) {
        mailRouter.credentials = await encryptString(JSON.stringify(mailRouter.credentials));
      } else {
        delete mailRouter['credentials'];
      }
      mergeFieldsInObject(['name', 'type', 'config', 'credentials'], mailRouter, storedMailRouter);
      await storedMailRouter.save();
    }
    return storedMailRouter;
  };

  delete = async (id) => {
    let originalMailRouter = await this.MailRouter.findByPk(id);
    if (originalMailRouter) {
      return await originalMailRouter.destroy();
    }
    return false;
  };
};
