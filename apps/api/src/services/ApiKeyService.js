const log = require('../util/log').getLogger('ApiKeyService');
const { generateApiKey } = require('generate-api-key');

const sequelize = require('../storage/sequelize');

module.exports = class {
  constructor() {
    this.ApiKey = sequelize.get().models.ApiKey;
  }

  findWithId = async (id) => {
    return await this.ApiKey.findByPk(id);
  };

  findAll = async () => {
    let result = await this.ApiKey.findAll();
    result.map((apiKey) => (apiKey.apiKey = `**************************${apiKey.apiKey.substring(apiKey.apiKey.length - 7)}`));
    return result;
  };

  findWithApiKey = async (apiKey) => {
    if (!apiKey) {
      return null;
    }
    return await this.ApiKey.findOne({
      where: { apiKey }
    });
  };

  createApiKey = async (name) => {
    return await this.ApiKey.create({
      name: name ? name : 'New Api Key',
      apiKey: generateApiKey({ method: 'string', length: 32, pool: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' }),
      enabled: true,
      permissions: {}
    });
  };

  deleteApiKey = async (id) => {
    let item = await this.ApiKey.findByPk(id);
    if (item) {
      return await item.destroy();
    }
  };
};
