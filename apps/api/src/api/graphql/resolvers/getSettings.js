let { getSettings } = require('../../../services/SettingsService');
const log = require('../../../util/log').getLogger('getSettings');

module.exports = async (parent, { names }, context, info) => {
  log.debug(`Get settings ${names}`);

  return await getSettings(names);
};
