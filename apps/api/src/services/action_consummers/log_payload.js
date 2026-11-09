const log = require('../../util/log').getLogger('log_payload');

module.exports = async (payload) => {
  let logLevel = 'INFO';
  if ('level' in payload) {
    logLevel = payload.level;
  }
  if (payload.message) {
    log.log(logLevel, payload.message);
  }
};
