const sequelize = require('../storage/sequelize');
const { getCachedSettings } = require('./SettingsService');

module.exports = class {
  constructor() {
    this.History = sequelize.get()?.models?.History;
  }

  findAll = async (ressource_type, ressource_id, limit = 100, offset = 0) => {
    let where = {};
    if (ressource_type) {
      where['ressource_type'] = ressource_type;
    }
    if (ressource_id) {
      where['ressource_id'] = ressource_id;
    }
    let result = await this.History.findAll({ where, order: [['id', 'DESC']], limit, offset });
    let total = await this.History.count({ where });
    return { limit, offset, total, history: result };
  };

  createHistory = async (user, activity, type, ressource_type, ressource_id, log_level) => {
    let { min_notification_level } = await getCachedSettings(['min_notification_level']);

    let history = await this.History.create({
      user: user ?? '',
      activity: activity ?? {},
      type: type,
      ressource_type: ressource_type,
      ressource_id: ressource_id,
      log_level: log_level,
      need_notification: log_level >= (min_notification_level ?? 5)
    });
    return history;
  };

  markHistoryAsRead = async (id) => {
    let existingHistory = await this.History.findByPk(id);
    existingHistory.need_notification = false;
    await existingHistory.save();
    return existingHistory;
  };
};
