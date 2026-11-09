const log = require('../util/log').getLogger('PartnerService');

const sequelize = require('../storage/sequelize');
const { mergeFieldsInObject } = require('./utils/DatabaseUtils');
const { Op } = require('sequelize');

module.exports = class {
  constructor() {
    this.Partner = sequelize.get().models.Partner;
    this._clearCache();
  }

  _clearCache() {
    this.partnersById = {};
    if (!process.env.JEST_WORKER_ID) {
      this._timeOut = setTimeout(this._clearCache.bind(this), 5 * 60 * 1000);
    }
  }

  findWithId = async (id) => {
    return await this.Partner.findByPk(id);
  };

  deleteWithId = async (id) => {
    let partner = await this.Partner.findByPk(id);
    if (partner) {
      await partner.destroy();
    }
  };

  findWithIdFromCache = async (id) => {
    if (!(id in this.partnersById)) {
      this.partnersById[id] = await this.findWithId(id);
    }
    return this.partnersById[id];
  };

  findAll = async (offset = 0, limit = 100, filter = {}) => {
    let where = await this._buildWhereFromFilter(filter);
    return await this.Partner.findAll({
      where,
      order: [['name', 'ASC']],
      offset,
      limit
    });
  };

  countAll = async (filter) => {
    let where = await this._buildWhereFromFilter(filter);
    return await this.Partner.count({
      where: Object.keys(where).length > 0 ? where : null
    });
  };

  _buildWhereFromFilter = async (filter) => {
    let where = {};
    if (filter) {
      if ('validatorsEmails' in filter && filter.validatorsEmails) {
        where['validatorsEmails'] = {
          [Op.iLike]: `%${filter['validatorsEmails']}%`
        };
      }
      if ('name' in filter && filter.name) {
        where['name'] = {
          [Op.iLike]: `%${filter['name']}%`
        };
      }
    }

    return where;
  };

  createPartner = async (name) => {
    log.debug(`Create new Partner with name ${name}`);

    try {
      let partner = await this.Partner.create({
        name: name ? name : 'New Partner'
      });

      log.debug(`REsult ${JSON.stringify(partner)}`);
      return partner;
    } catch (ex) {
      console.log(ex);
    }
  };
  updatePartner = async (partner) => {
    let storedPartner = await this.Partner.findByPk(partner.id);
    if (storedPartner) {
      mergeFieldsInObject(['name', 'validatorsEmails', 'defaultMessage', 'contacts', 'defaultValidationRate', 'variables', 'kitMapping'], partner, storedPartner);
      await storedPartner.save();
    }
    return storedPartner;
  };
};
