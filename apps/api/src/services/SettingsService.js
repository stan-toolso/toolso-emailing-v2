const log = require('../util/log').getLogger('SettingsService');
const fs = require('fs');
const sequelize = require('../storage/sequelize');
const { getJwtSecret } = require('./JwtSecretService');
const { Op } = require('sequelize');
var CryptoJS = require('crypto-js');

let _defaultSettings = {};
let _cache = {};
let _initialized = false;

const _initWithDefaultFile = () => {
  let rawdata = fs.readFileSync('config/defaultSettings.json');
  let settings = JSON.parse(rawdata);
  initDefaultvalues(settings);
};

const initDefaultvalues = (settings) => {
  log.info(`Init settings with default values ${JSON.stringify(settings)}`);
  _defaultSettings = settings;
  _initialized = true;
};

const setSetting = (name, value) => {
  _cache[name] = value;
};

const getSettings = async (settings, valueConvertor) => {
  if (!_initialized) {
    _initWithDefaultFile();
  }
  let defaultSettings = Array.isArray(settings) ? _defaultSettings : settings;
  let names = Array.isArray(settings) ? settings : Object.keys(settings);

  //log.debug(`Get settings ${JSON.stringify(settings)}`);
  let values = await sequelize.get().models.Settings.findAll({
    where: {
      name: {
        [Op.in]: names
      }
    }
  });
  let result = {};
  for (let name of names) {
    result[name] = name in defaultSettings ? defaultSettings[name] : null;
    _cache[name] = result[name];
  }

  values.forEach((value) => {
    let convertedValue = valueConvertor ? valueConvertor(JSON.parse(value.value)) : value.value;
    switch (typeof result[value.name]) {
      case 'boolean':
      case 'object':
        convertedValue = JSON.parse(convertedValue);
        break;
      case 'number':
        convertedValue = parseFloat(convertedValue);
        break;
      default:
        break;
    }
    _cache[value.name] = convertedValue;
    result[value.name] = convertedValue;
  });
  return result;
};

const getEncryptedSettings = async (settings) => {
  let jwtSecret = await getJwtSecret();
  return await getSettings(settings, (value) => {
    return CryptoJS.AES.decrypt(value, jwtSecret).toString(CryptoJS.enc.Utf8);
  });
};

const encryptString = async (stringToEncrypt) => {
  let jwtSecret = await getJwtSecret();
  return CryptoJS.AES.encrypt(stringToEncrypt, jwtSecret).toString();
};

const decryptString = async (stringToDecrypt) => {
  let jwtSecret = await getJwtSecret();
  return CryptoJS.AES.decrypt(stringToDecrypt, jwtSecret).toString(CryptoJS.enc.Utf8);
};

const updateEncryptedSettings = async (name, value) => {
  let jwtSecret = await getJwtSecret();
  return await updateSettings(name, CryptoJS.AES.encrypt(JSON.stringify(value), jwtSecret).toString());
};
const updateSettings = async (name, value) => {
  log.debug(`Update settings ${name} with value ${JSON.stringify(value)}}`);
  let settings = await sequelize.get().models.Settings.findOne({
    where: { name }
  });
  if (!settings) {
    settings = await sequelize.get().models.Settings.build({ name });
  }
  settings.value = JSON.stringify(value);
  await settings.save();
  return {
    [name]: value
  };
};

module.exports = {
  initDefaultvalues,

  getCachedSettings: async (names) => {
    let result = {};
    let missingSettings = [];
    for (let name of names) {
      if (name in _cache) {
        result[name] = _cache[name];
      } else {
        missingSettings.push(name);
      }
    }
    if (missingSettings.length > 0) {
      missingSettings = await getSettings(missingSettings);
      result = { ...result, ...missingSettings };
    }
    return result;
  },

  getSettings,
  setSetting,
  updateSettings,

  getEncryptedSettings,
  updateEncryptedSettings,

  encryptString,
  decryptString
};
