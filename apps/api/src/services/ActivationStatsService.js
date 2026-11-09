const log = require('../util/log').getLogger('ActivationStatsService');
const moment = require('moment-timezone');
const sequelize = require('../storage/sequelize');
const { Op } = require('sequelize');
const { getSettings } = require('./SettingsService');

module.exports = class {
  constructor() {
    this.ActivationStats = sequelize.get().models.ActivationStats;
  }

  _getTimezone = async () => {
    if (this.timezone) {
      return this.timezone;
    }
    const { timezone } = await getSettings({ timezone: 'Europe/Paris' });
    this.timezone = timezone;
    return this.timezone;
  };

  getOrCreateTodayStats = async (esp) => {
    let today = moment()
      .tz(await this._getTimezone())
      .format('YYYY-MM-DD');

    let activationStats = await this.ActivationStats.findOne({
      where: {
        date: today,
        esp
      }
    });
    if (!activationStats) {
      activationStats = {
        date: today,
        esp
      };
      await this.ActivationStats.create(activationStats);
    }
    return activationStats;
  };

  getEspInscriptionStats = async (esp, fromDate, toDate) => {
    return await this.ActivationStats.findAll({
      where: {
        esp,
        date: {
          [Op.gte]: fromDate,
          [Op.lte]: toDate
        }
      },
      order: [['date', 'DESC']]
    });
  };
  getActivationStats = async (fromDate, toDate, esp) => {
    let where = {
      date: {
        [Op.gte]: fromDate,
        [Op.lte]: toDate
      }
    };
    if (esp) {
      where.esp = esp;
    }
    return await this.ActivationStats.findAll({
      where,
      order: [['date', 'DESC']]
    });
  };

  /*
   * Increment the field of the activation stats of the given esp and the given date
   */
  incField = async (esp, field, date = new Date(), value = 1) => {
    let today = moment(date)
      .tz(await this._getTimezone())
      .format('YYYY-MM-DD');

    let result = await this.ActivationStats.update({ [field]: sequelize.get().literal(`"ActivationStats"."${field}" + ${value}`) }, { where: { date: today, esp } });

    if (result && result[0] == 0) {
      await this.ActivationStats.create({ date: today, esp, [field]: value });
    }
  };

  /*
   * Increment the field of the activation stats of the given esp and the given date
   */
  setField = async (esp, field, date = new Date(), value) => {
    let today = moment(date)
      .tz(await this._getTimezone())
      .format('YYYY-MM-DD');

    let result = await this.ActivationStats.update({ [field]: value }, { where: { date: today, esp } });

    if (result && result[0] == 0) {
      await this.ActivationStats.create({ date: today, esp, [field]: value });
    }
  };
};
