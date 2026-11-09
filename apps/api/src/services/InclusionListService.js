const sequelize = require('../storage/sequelize');
const log = require('../util/log').getLogger('InclusionListService');
const { Op } = require('sequelize');
const { PromisePool } = require('@supercharge/promise-pool');
const { mergeFieldsInObject } = require('./utils/DatabaseUtils');

module.exports = class {
  constructor() {
    this.InclusionList = sequelize.get()?.models?.InclusionList;
    this.InclusionListItem = sequelize.get()?.models?.InclusionListItem;

    this.inclusionListCached = {};
  }

  findWithId = async (id) => {
    return await this.InclusionList.findByPk(id);
  };
  findWithIdInCache = async (id) => {
    if (!(id in this.inclusionListCached)) {
      this.inclusionListCached[id] = await this.findWithId(id);
    }
    return this.inclusionListCached[id];
  };

  findAll = async (offset = 0, limit = 100, filter = {}) => {
    let where = this._buildWhereFromFilter(filter);

    return await this.InclusionList.findAll({
      where,
      order: [['id', 'DESC']],
      offset,
      limit
    });
  };

  countAll = async (filter) => {
    let where = this._buildWhereFromFilter(filter);
    return await this.InclusionList.count({
      where: Object.keys(where).length > 0 ? where : null
    });
  };

  _buildWhereFromFilter = (filter) => {
    let where = {};
    if (filter) {
      if ('name' in filter) {
        where['name'] = {
          [Op.iLike]: `%${filter['name']}%`
        };
      }
    }

    return where;
  };

  findAllItems = async (offset = 0, limit = 100, filter = {}) => {
    let where = this._buildWhereFromFilterItems(filter);

    return await this.InclusionListItem.findAll({
      where,
      order: [['id', 'DESC']],
      offset,
      limit
    });
  };

  countAllItems = async (filter) => {
    let where = this._buildWhereFromFilterItems(filter);
    return await this.InclusionListItem.count({
      where: Object.keys(where).length > 0 ? where : null
    });
  };

  _buildWhereFromFilterItems = (filter) => {
    let where = {};
    if (filter) {
      if ('inclusionListId' in filter) {
        where['inclusionListId'] = filter['inclusionListId'];
      }
      if ('value' in filter) {
        where['value'] = {
          [Op.iLike]: `%${filter['value']}%`
        };
      }
    }

    return where;
  };

  createInclusionList = async (name) => {
    return await this.InclusionList.create({
      name: name ? name : 'New Inclusion List',
      field: 'md5'
    });
  };
  deleteInclusionList = async (id) => {
    let item = await this.InclusionList.findByPk(id);
    if (item) {
      await item.destroy();
    }
  };

  updateInclusionList = async (inclusionList) => {
    let storedInclusionList = await this.InclusionList.findByPk(inclusionList.id);
    if (storedInclusionList) {
      mergeFieldsInObject(['name', 'field'], inclusionList, storedInclusionList);
      await storedInclusionList.save();
    }
    return storedInclusionList;
  };

  replaceAllInclusionListItem = async (inclusionListId, values) => {
    log.info(`Replace all exlusion items for list ${inclusionListId} with ${values.length} new items`);
    let inclusionList = await this.findWithId(inclusionListId);
    if (!inclusionList) {
      log.warn(`Inclusion List ${inclusionListId} not found`);
    }
    if (!inclusionList.uploadStatus) {
      inclusionList.uploadStatus = {};
    }
    inclusionList.uploadStatus.status = 'loading_contacts';
    inclusionList.uploadStatus.contactImported = 0;
    inclusionList.uploadStatus.total = values.length;

    await this.InclusionListItem.destroy({
      where: {
        inclusionListId
      }
    });
    log.info(`Old items have been destroyed for list ${inclusionListId}`);

    log.debug(`Create batches`);

    let batches = [];
    let currentBatch = [];
    batches.push(currentBatch);
    for (let i = 0; i < values.length; i++) {
      if (!values[i]) {
        continue;
      }
      currentBatch.push({
        inclusionListId,
        value: values[i]
      });
      if (currentBatch.length >= 100) {
        currentBatch = [];
        batches.push(currentBatch);
      }
    }
    log.debug(`${batches.length} batches ready`);

    await PromisePool.withConcurrency(10)
      .for(batches)
      .process(async (batch) => {
        await this.InclusionListItem.bulkCreate(batch);

        inclusionList.uploadStatus.contactImported += batch.length;
        inclusionList.uploadStatus.lastActivityDate = new Date();
        inclusionList.changed('uploadStatus', true);
        log.debug(`Contact imported ${inclusionList.uploadStatus.contactImported}`);
        await inclusionList.save();
      });
    inclusionList.stats = {
      count: values.length
    };

    inclusionList.uploadStatus.status = 'done';

    inclusionList.changed('uploadStatus', true);
    inclusionList.changed('stats', true);

    await inclusionList.save();
    log.info(`New items have been created `);
  };

  isContactIncluded = async (contact, inclusionListId, field) => {
    if (!field) {
      let exlusionList = await this.findWithIdInCache(inclusionListId);
      if (exlusionList) {
        field = exlusionList.field;
      }
    }

    let value = null;
    if (field === 'email') {
      value = contact.email;
    } else if (field === 'md5') {
      value = contact.md5;
    } else if (field === 'sha1') {
      value = contact.sha1;
    } else if (field === 'sha256') {
      value = contact.sha256;
    }
    if (!value) {
      return false;
    }

    let item = await this.InclusionListItem.findOne({
      where: {
        value,
        inclusionListId
      }
    });
    return item != null;
  };
};
