const log4js = require('log4js');

// Niveau de log depuis l'environnement (ALL, TRACE, DEBUG, INFO, WARN, ERROR, FATAL, OFF). Défaut : INFO.
const level = (process.env.LOG_LEVEL || 'INFO').toUpperCase();

log4js.configure({
  appenders: { console: { type: 'console' } },
  categories: { default: { appenders: ['console'], level } }
});

module.exports = {
  getLogger: (name) => {
    return log4js.getLogger(name);
  }
};
