const { mergeFieldsInObject } = require('./utils/DatabaseUtils');

const log = require('../util/log').getLogger('ContentTemplateService');
const sequelize = require('../storage/sequelize');
const Sequelize = require('sequelize');

const { Op } = Sequelize;

const cacheById = {};

module.exports = class {
  constructor() {
    this.ContentTemplate = sequelize.get()?.models?.ContentTemplate;
  }

  findWithIdInCache = async (id) => {
    if (!(id in cacheById)) {
      cacheById[id] = await this.findWithId(id);
    }
    return cacheById[id];
  };

  findWithId = async (id) => {
    return await this.ContentTemplate.findByPk(id);
  };

  findAll = async (offset = 0, limit = 100, filters = {}) => {
    let where = {};
    if (filters) {
      if ('name' in filters) {
        where['name'] = {
          [Op.like]: `%${filters['name']}%`
        };
      }
    }
    return await this.ContentTemplate.findAll({
      where: Object.keys(where).length > 0 ? where : null,
      order: [['id', 'DESC']],
      offset: offset,
      limit: limit
    });
  };
  countAll = async (filter) => {
    let where = {};
    if (filter) {
      if ('name' in filter) {
        where['name'] = {
          [Op.like]: `%${filter['name']}%`
        };
      }
    }
    return await this.ContentTemplate.count({
      where: Object.keys(where).length > 0 ? where : null
    });
  };

  createContentTemplate = async (name) => {
    return await this.ContentTemplate.create({
      name: name
    });
  };

  duplicateContentTemplate = async (id, name) => {
    let originalContentTemplate = await this.ContentTemplate.findByPk(id);
    if (!originalContentTemplate) {
      return null;
    }
    return await this.ContentTemplate.create({
      name: name,
      html: originalContentTemplate.html,
      previewText: originalContentTemplate.previewText,
      senderName: originalContentTemplate.senderName,
      subject: originalContentTemplate.subject,
      frenchEspsSubject: originalContentTemplate.frenchEspsSubject
    });
  };

  deleteContentTemplate = async (id) => {
    let originalContentTemplate = await this.ContentTemplate.findByPk(id);
    if (originalContentTemplate) {
      return await originalContentTemplate.destroy();
    }
  };

  updateContentTemplate = async (contentTemplate) => {
    let storedContentTemplate = await this.ContentTemplate.findByPk(contentTemplate.id);
    if (storedContentTemplate) {
      mergeFieldsInObject(['name', 'subject', 'frenchEspsSubject', 'html', 'senderName', 'previewText'], contentTemplate, storedContentTemplate);
      await storedContentTemplate.save();
    }
    return storedContentTemplate;
  };
};
