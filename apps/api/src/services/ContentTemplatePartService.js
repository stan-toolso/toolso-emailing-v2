const { mergeFieldsInObject } = require('./utils/DatabaseUtils');

const log = require('../util/log').getLogger('ContentTemplatePartService');
const sequelize = require('../storage/sequelize');
const Sequelize = require('sequelize');

const { Op } = Sequelize;

module.exports = class {
  constructor() {
    this.cache = null;
    this.ContentTemplatePart = sequelize.get()?.models?.ContentTemplatePart;
  }

  findWithId = async (id) => {
    return await this.ContentTemplatePart.findByPk(id);
  };
  findAllInCache = async () => {
    if (!this.cache) {
      this.cache = await this.ContentTemplatePart.findAll();
    }
    return this.cache;
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
    return await this.ContentTemplatePart.findAll({
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
    return await this.ContentTemplatePart.count({
      where: Object.keys(where).length > 0 ? where : null
    });
  };

  create = async (name) => {
    let uid = name
      .toLowerCase()
      .replace(/ - /g, '-')
      .replace(/ /g, '-')
      .replace(/[^\w\s\-]/gi, '');
    return await this.ContentTemplatePart.create({
      uid,
      name
    });
  };

  duplicate = async (id, name) => {
    let uid = name
      .toLowerCase()
      .replace(/ - /g, '-')
      .replace(/ /g, '-')
      .replace(/[^\w\s\-]/gi, '');

    let originalContentTemplatePart = await this.ContentTemplatePart.findByPk(id);
    if (!originalContentTemplatePart) {
      return null;
    }
    return await this.ContentTemplatePart.create({
      name,
      uid,
      html: originalContentTemplatePart.html
    });
  };

  delete = async (id) => {
    let originalContentTemplatePart = await this.ContentTemplatePart.findByPk(id);
    if (originalContentTemplatePart) {
      return await originalContentTemplatePart.destroy();
    }
  };

  update = async (contentTemplatePart) => {
    let storedContentTemplatePart = await this.ContentTemplatePart.findByPk(contentTemplatePart.id);
    if (storedContentTemplatePart) {
      if (contentTemplatePart.uid) {
        contentTemplatePart.uid = contentTemplatePart.uid
          .toLowerCase()
          .replace(/ - /g, '-')
          .replace(/ /g, '-')
          .replace(/[^\w\s\-]/gi, '');
      }
      mergeFieldsInObject(['name', 'uid', 'html'], contentTemplatePart, storedContentTemplatePart);
      await storedContentTemplatePart.save();
    }
    return storedContentTemplatePart;
  };
};
