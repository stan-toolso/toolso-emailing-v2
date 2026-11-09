const sequelize = require('../storage/sequelize');
const log = require('../util/log').getLogger('ExclusionListService');
const { Op } = require('sequelize');
const { PromisePool } = require('@supercharge/promise-pool');
const { mergeFieldsInObject } = require('./utils/DatabaseUtils');

module.exports = class {
  constructor() {
    this.ExclusionList = sequelize.get()?.models?.ExclusionList;
    this.ExclusionListItem = sequelize.get()?.models?.ExclusionListItem;

    this.exclusionListCached = {};
  }

  findWithId = async (id) => {
    return await this.ExclusionList.findByPk(id);
  };
  findWithIdInCache = async (id) => {
    if (!(id in this.exclusionListCached)) {
      this.exclusionListCached[id] = await this.findWithId(id);
    }
    return this.exclusionListCached[id];
  };

  findAll = async (offset = 0, limit = 100, filter = {}) => {
    let where = this._buildWhereFromFilter(filter);

    return await this.ExclusionList.findAll({
      where,
      order: [['id', 'DESC']],
      offset,
      limit
    });
  };

  countAll = async (filter) => {
    let where = this._buildWhereFromFilter(filter);
    return await this.ExclusionList.count({
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

    return await this.ExclusionListItem.findAll({
      where,
      order: [['id', 'DESC']],
      offset,
      limit
    });
  };

  countAllItems = async (filter) => {
    let where = this._buildWhereFromFilterItems(filter);
    return await this.ExclusionListItem.count({
      where: Object.keys(where).length > 0 ? where : null
    });
  };

  _buildWhereFromFilterItems = (filter) => {
    let where = {};
    if (filter) {
      if ('exclusionListId' in filter) {
        where['exclusionListId'] = filter['exclusionListId'];
      }
      if ('value' in filter) {
        where['value'] = {
          [Op.iLike]: `%${filter['value']}%`
        };
      }
    }

    return where;
  };

  createExclusionList = async (name) => {
    return await this.ExclusionList.create({
      name: name ? name : 'New Exclusion List',
      field: 'md5'
    });
  };
  deleteExclusionList = async (id) => {
    let item = await this.ExclusionList.findByPk(id);
    if (item) {
      await item.destroy();
    }
  };

  updateExclusionList = async (exclusionList) => {
    let storedExclusionList = await this.ExclusionList.findByPk(exclusionList.id);
    if (storedExclusionList) {
      mergeFieldsInObject(['name', 'field'], exclusionList, storedExclusionList);
      await storedExclusionList.save();
    }
    return storedExclusionList;
  };

  replaceAllExclusionListItem = async (exclusionListId, values) => {
    log.info(`Replace all exlusion items for list ${exclusionListId} with ${values} new items`);
    let exclusionList = await this.findWithId(exclusionListId);
    if (!exclusionList) {
      log.warn(`Exclusion List ${exclusionListId} not found`);
    }
    if (!exclusionList.uploadStatus) {
      exclusionList.uploadStatus = {};
    }
    exclusionList.uploadStatus.status = 'loading_contacts';
    exclusionList.uploadStatus.contactImported = 0;
    exclusionList.uploadStatus.total = values.length;

    await this.ExclusionListItem.destroy({
      where: {
        exclusionListId
      }
    });
    log.info(`Old items have been destroyed ${exclusionListId}`);

    log.debug(`Create batches`);

    let batches = [];
    let currentBatch = [];
    batches.push(currentBatch);
    for (let i = 0; i < values.length; i++) {
      if (!values[i]) {
        continue;
      }
      currentBatch.push({
        exclusionListId,
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
        await this.ExclusionListItem.bulkCreate(batch);

        exclusionList.uploadStatus.contactImported += batch.length;
        exclusionList.uploadStatus.lastActivityDate = new Date();
        exclusionList.changed('uploadStatus', true);
        log.debug(`Contact imported ${exclusionList.uploadStatus.contactImported}`);
        await exclusionList.save();
      });

    exclusionList.stats = {
      count: values.length
    };

    exclusionList.uploadStatus.status = 'done';

    exclusionList.changed('uploadStatus', true);
    exclusionList.changed('stats', true);

    await exclusionList.save();
    log.info(`New items have been created `);
  };

  isContactExcluded = async (contact, exclusionListId, field) => {
    if (!field) {
      let exlusionList = await this.findWithIdInCache(exclusionListId);
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

    let item = await this.ExclusionListItem.findOne({
      where: {
        value,
        exclusionListId
      }
    });
    return item != null;
  };
};
