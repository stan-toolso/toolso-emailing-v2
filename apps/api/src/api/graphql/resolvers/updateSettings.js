let { updateSettings } = require('../../../services/SettingsService');
const log = require('../../../util/log').getLogger('UpdateSettings');

module.exports = async (parent, { settings }, context, info) => {
  log.debug(`Update settings ${JSON.stringify(settings)}`);
  let result = {};
  for (let name in settings) {
    let updatedSettings = await updateSettings(name, settings[name]);
    result = { ...result, ...updatedSettings };
  }
  return result;
};
