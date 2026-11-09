const { Sequelize } = require('sequelize');
const log = require('../util/log').getLogger('Sequelize');
const getPg = require('../infra/getPg');
const config = require('../util/config');

let sequelize = null;

/**
 * Connexion PostgreSQL de l'instance. Une instance = une base emailing (`RESOURCE_UID`) : la connexion vient de
 * `DATABASE_URL` (plus de Secrets Manager). `PGSSL=true` active TLS (certificat non vérifié, comme en v1).
 */
module.exports = {
  get: () => {
    return sequelize;
  },

  /**
   * @param {number} [maxConcurrency] taille max du pool (défaut : PG_POOL_MAX ou 10)
   * @param {string} [uid] ignoré (conservé pour la compatibilité des appels d'origine : une instance ne sert qu'une base)
   */
  initWithPostgresql: async (maxConcurrency, uid) => {
    const RESOURCE_UID = uid ?? config.resourceUid();
    log.info(`Init sequelize with [${RESOURCE_UID}] postgresql`);
    try {
      sequelize = _create_sequelize(process.env.DATABASE_URL, maxConcurrency ?? config.pgPoolMax());
      _init_model(sequelize);
      await sequelize.authenticate();
      return sequelize;
    } catch (err) {
      log.error(`Failed to init sequelize with DATABASE_URL`, err);
      throw err;
    }
  },

  /** Ferme la connexion (arrêt propre des process). */
  close: async () => {
    if (sequelize) {
      await sequelize.close();
      sequelize = null;
    }
  }
};

const _init_model = () => {
  [
    require('./models/ContentStats.model'),
    require('./models/Suggestion.model'),
    require('./models/Contact.model'),
    require('./models/ContactEvents.model'),
    require('./models/ContactSource.model'),
    require('./models/ContactInscription.model'),
    require('./models/ContactEvent.model'),
    require('./models/EmailTrackingDedup.model'),
    require('./models/ContactMessage.model'),
    require('./models/ContactMessageRule.model'),
    require('./models/IpAddress.model'),
    require('./models/Sender.model'),
    require('./models/Settings.model'),
    require('./models/ContactEventStats.model'),
    require('./models/ContactEventStatsAggregate.model'),
    require('./models/Schedule.model'),
    require('./models/Content.model'),
    require('./models/ContentVersion.model'),
    require('./models/ContentTemplate.model'),
    require('./models/ContentTemplatePart.model'),
    require('./models/SendingConfig.model'),
    require('./models/MailRouter.model'),
    require('./models/ContactContent.model'),
    require('./models/ContactStats.model'),
    require('./models/InscriptionStats.model'),
    require('./models/ApiKey.model'),
    require('./models/ExclusionList.model'),
    require('./models/ExclusionListItem.model'),
    require('./models/InclusionList.model'),
    require('./models/InclusionListItem.model'),
    require('./models/BlacklistedContact.model'),
    require('./models/Bat.model'),
    require('./models/Partner.model'),
    require('./models/Permission.model'),
    require('./models/ContentIncome.model'),
    require('./models/History.model'),
    require('./models/ActivationConfig.model'),
    require('./models/ActivationStats.model'),

    require('./models/SendingStrategiesScheduleStats.model'),

    // Nouveaux modèles de l'instance autonome
    require('./models/ActionQueue.model'),
    require('./models/Mirror.model')
  ].forEach((model) => {
    model(sequelize);
  });
  require('./models/associations')(sequelize);
};

const _create_sequelize = (databaseUrl, maxPoolSize) => {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not defined');
  }
  const dialectOptions = {
    statement_timeout: 14 * 60 * 1000
  };
  if (process.env.PGSSL === 'true') {
    dialectOptions.ssl = { rejectUnauthorized: false };
  }
  return new Sequelize(databaseUrl, {
    dialect: 'postgres',
    dialectModule: getPg(),
    dialectOptions,
    pool: {
      max: maxPoolSize ?? 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    logging: (msg) => log.trace(msg)
  });
};
