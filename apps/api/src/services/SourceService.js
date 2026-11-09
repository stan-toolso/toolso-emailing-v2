const sequelize = require('../storage/sequelize');
const { mergeFieldsInObject } = require('./utils/DatabaseUtils');
const log = require('../util/log').getLogger('SourceService');

const cacheById = {};

module.exports = class {
  constructor() {
    this.ContactSource = sequelize.get().models.ContactSource;
  }

  findWithId = async (id) => {
    return await this.ContactSource.findByPk(id);
  };

  findWithIdInCache = async (id) => {
    if (!(id in cacheById)) {
      cacheById[id] = await this.findWithId(id);
    }
    return cacheById[id];
  };

  getSourceFromName = async (sourceName) => {
    if (!sourceName) {
      return null;
    }
    log.debug(`Get source with sourceName ${sourceName}`);

    let allSources = await this.ContactSource.findAll();
    for (let element of allSources) {
      if (element.utmSource && element.utmSource == sourceName) {
        return element;
      }
      if (element.regexp && RegExp(element.regexp).test(sourceName)) {
        return element;
      }
    }
    return null;
  };

  getSourceFromApiKey = async (apiKey) => {
    log.debug(`Get source with apikey ${apiKey}`);
    return await this.ContactSource.findOne({
      where: { apiKey }
    });
  };

  findAll = async (offset = 0, limit = 100) => {
    return await this.ContactSource.findAll({
      order: [['id', 'DESC']],
      offset,
      limit
    });
  };

  countAll = async () => {
    return await this.ContactSource.count();
  };

  createWithName = async (name, parentSourceId) => {
    return await this.ContactSource.create({
      name,
      parentSourceId
    });
  };

  update = async (source) => {
    let storedSource = await this.ContactSource.findByPk(source.id);
    if (storedSource) {
      mergeFieldsInObject(
        ['name', 'regexp', 'utmSource', 'apiEnabled', 'apiKey', 'apiFields', 'apiScheduleIds', 'apiSettings', 'parentSourceId', 'childConfig', 'defaultChildSourceId'],
        source,
        storedSource
      );
      await storedSource.save();
    }
    return storedSource;
  };

  enableChildSource = async (sourceId) => {
    let existingSource = await this.ContactSource.findByPk(sourceId);
    let apiKeyToCreate = existingSource.apiKey;
    log.warn('apiKey to transform', apiKeyToCreate);
    let newFather = await this.ContactSource.create({
      name: existingSource.name,
      regexp: existingSource.regexp,
      apiFields: existingSource.apiFields,
      apiScheduleIds: existingSource.apiScheduleIds,
      apiEnabled: existingSource.apiEnabled,
      utmSource: existingSource.utmSource,
      apiSettings: existingSource.apiSettings,
      defaultChildSourceId: existingSource.id
    });
    existingSource.apiEnabled = false;
    existingSource.apiKey = null;
    existingSource.apiScheduleIds = null;
    existingSource.apiFields = null;
    existingSource.parentSourceId = newFather.id;
    await existingSource.save();
    newFather.apiKey = apiKeyToCreate;
    await newFather.save();
    return newFather;
  };
};
