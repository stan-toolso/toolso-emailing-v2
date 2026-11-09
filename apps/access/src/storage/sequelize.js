const { Sequelize } = require('sequelize');
const log = require('../log').getLogger('Sequelize');
const config = require('../config');

let sequelize = null;

module.exports = {
  get: () => {
    return sequelize;
  },

  // Connexion à la base access par DATABASE_URL (postgres://user:pass@host:5432/access).
  // PGSSL=true active SSL (certificat non vérifié, comme avec RDS).
  initAccess: async (initModel = true) => {
    log.info(`Init sequelize with toolso_access postgresql`);

    const options = {
      dialect: 'postgres',
      logging: false
    };
    if (config.pgSsl()) {
      options.dialectOptions = { ssl: { require: true, rejectUnauthorized: false } };
    }
    sequelize = new Sequelize(config.databaseUrl(), options);
    initModel && _init_model();
    return sequelize;
  }
};

const _init_model = () => {
  [
    require('./models/Entreprise.model'),
    require('./models/User.model'),
    require('./models/EmailingDatabase.model'),
    require('./models/Site.model'),
    require('./models/UserEntreprise.model'),
    require('./models/SuperUser.model')
  ].forEach((model) => {
    model(sequelize);
  });
  require('./models/associations')(sequelize);
};
