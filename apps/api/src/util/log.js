const log4js = require('log4js');

const LOG_LEVEL = process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'INFO';

log4js.configure({
  appenders: { console: { type: 'console' } },
  categories: { default: { appenders: ['console'], level: LOG_LEVEL } }
});
log4js.getLogger('Logger').info('Logger initialized');

module.exports = {
  getLogger: (name) => {
    return log4js.getLogger(name);
  }
};
