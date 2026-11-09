const log = require('../util/log').getLogger('SyncModel');
const { postSynchroSQL } = require('./models/postSynchroSQL');

/** Vues créées par postSynchroSQL : à supprimer avant `sync({ alter: true })`, qui ne peut pas modifier une colonne dont une vue dépend. */
const VIEWS = ['SendingStrategiesResults', 'ScheduleReport', 'RouterComplaints', 'RouterUnsubs', 'ContactByStatus'];

/**
 * Crée ou met à jour le schéma de la base emailing (ex-job `build_model` / `update_model_with_sequelize.js`), de façon
 * rejouable : prérequis (extension pg_trgm, rôle grafanareader), suppression des vues, `sync({ alter: true })`,
 * puis SQL complémentaire (vues, index trigram).
 */
const syncModel = async (sequelize) => {
  await sequelize.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
  await sequelize.query(`DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'grafanareader') THEN CREATE ROLE grafanareader NOLOGIN; END IF; END $$;`);
  for (const view of VIEWS) {
    await sequelize.query(`DROP VIEW IF EXISTS "${view}"`);
  }
  log.info('Sync models (alter)');
  await sequelize.sync({ force: false, alter: true });
  log.info('Create views and indexes');
  await sequelize.query(postSynchroSQL);
};

module.exports = { syncModel, VIEWS };
