const log = require('../util/log').getLogger('ContactStatsService');
const moment = require('moment-timezone');
const sequelize = require('../storage/sequelize');
const { getSettings } = require('./SettingsService');
const ContactStatus = require('../storage/models/ContactStatus');
const { Op } = require('sequelize');

function incrementStatsByStatus(statsObject, contact) {
  if (!(contact.status in statsObject.contactByStatus)) {
    statsObject.contactByStatus[contact.status] = 0;
  }
  statsObject.contactByStatus[contact.status]++;
}

function incrementStatsByEsps(statsObject, contact) {
  if (!(contact.esp in statsObject.contactByEsps)) {
    statsObject.contactByEsps[contact.esp] = 0;
  }
  statsObject.contactByEsps[contact.esp]++;
}

function incrementNotExploitedByEsps(statsObject, contact) {
  if (!(contact.esp in statsObject.notExploitedByEsps)) {
    statsObject.notExploitedByEsps[contact.esp] = 0;
  }
  if (contact.status == ContactStatus.new && (!contact.stats || !contact.stats.request)) {
    statsObject.notExploitedByEsps[contact.esp]++;
  }
}

function incrementStatsByAges(statsObject, contact, timezone) {
  if (contact.dob) {
    let age = moment.tz(timezone).diff(moment.tz(contact.dob, 'YYYY-MM-DD', timezone), 'years');
    if (!(age in statsObject.contactByAges)) {
      statsObject.contactByAges[age] = 0;
    }
    statsObject.contactByAges[age]++;
  }
}

function incrementStatsByGenders(statsObject, contact) {
  if (contact.gender) {
    if (!(contact.gender in statsObject.contactByGenders)) {
      statsObject.contactByGenders[contact.gender] = 0;
    }
    statsObject.contactByGenders[contact.gender]++;
  }
}

function incrementStatsByActivityScores(statsObject, contact) {
  if (contact.status == ContactStatus.workable || contact.status == ContactStatus.new) {
    var activityScore = Math.round(contact.activityScore);
    if (!isNaN(activityScore)) {
      if (!(activityScore in statsObject.contactByActivityScores)) {
        statsObject.contactByActivityScores[activityScore] = 0;
      }
      statsObject.contactByActivityScores[activityScore]++;
    }
  }
}

module.exports = class {
  constructor() {
    this.Contact = sequelize.get().models.Contact;
    this.ContactStats = sequelize.get().models.ContactStats;
  }

  _getTimezone = async () => {
    if (this.timezone) {
      return this.timezone;
    }
    const { timezone } = await getSettings({ timezone: 'Europe/Paris' });
    this.timezone = timezone;
    return this.timezone;
  };

  _getDefaultStats = () => {
    return {
      count: 0,
      not_exploited: 0,
      contactByEsps: {},
      notExploitedByEsps: {},
      contactByStatus: {},
      contactByActivityScores: {},
      contactByAges: {},
      contactByGenders: {}
    };
  };
  updateContactStats = async () => {
    let date = moment()
      .tz(await this._getTimezone())
      .format('YYYY-MM-DD');
    log.info(`Start contact stats update today ${date}`);
    let statsObject = this._getDefaultStats();
    let offset = 0;
    let hasContact = true;
    while (hasContact) {
      let contacts = await this.Contact.findAll({
        offset: offset,
        limit: 50000,
        attributes: ['id', 'status', 'esp', 'activityScore', 'gender', 'dob', 'stats'],
        order: [['id', 'ASC']]
      });
      for (let contact of contacts) {
        statsObject.count++;
        incrementStatsByStatus(statsObject, contact);
        if (contact.status == ContactStatus.workable || contact.status == ContactStatus.new) {
          if (contact.status == ContactStatus.new && (!contact.stats || !contact.stats.request)) {
            statsObject.not_exploited = (statsObject.not_exploited ?? 0) + 1;
          }
          incrementStatsByEsps(statsObject, contact);
          incrementNotExploitedByEsps(statsObject, contact);
          incrementStatsByGenders(statsObject, contact);
          incrementStatsByAges(statsObject, contact, await this._getTimezone());
          incrementStatsByActivityScores(statsObject, contact);
        }
      }

      if (contacts.length == 0) {
        hasContact = false;
      } else {
        offset += contacts.length;
        log.debug(`Offset ${offset}`);
      }
    }

    let updateResult = await this.ContactStats.update(
      {
        stats: statsObject
      },
      {
        where: {
          date: date
        }
      }
    );
    if (!updateResult || !updateResult[0]) {
      //we have to create the row
      await this.ContactStats.create({
        date: date,
        stats: statsObject
      });
    }
  };

  getLastContactStats = async () => {
    let stats = await this.ContactStats.findOne({
      order: [['date', 'DESC']]
    });
    if (!stats) {
      stats = this._getDefaultStats();
    }
    return stats;
  };

  getContactStats = async (fromDate, toDate) => {
    let stats = await this.ContactStats.findAll({
      where: {
        date: {
          [Op.gte]: fromDate,
          [Op.lte]: toDate
        }
      },
      order: [['date', 'DESC']]
    });
    if (!stats) {
      stats = this._getDefaultStats();
    }
    return stats;
  };
};
