const fs = require('fs');
const path = require('path');
const { Cron } = require('croner');
const log = require('../util/log').getLogger('Scheduler process');
const config = require('../util/config');
const sequelize = require('../storage/sequelize');
const jobRunner = require('../jobs/runJob');

/**
 * Rôle `scheduler` : cron en process (ex-règles EventBridge → `toolso-access/emailing_jobs` → Lambda `{uid}_job`).
 * Les expressions sont dans `config/schedules.json` (surcharge : `SCHEDULES_FILE`), en UTC comme EventBridge
 * (`CRON_TZ` pour changer). Un verrou consultatif PostgreSQL par job empêche deux exécutions simultanées
 * (plusieurs schedulers, ou job plus long que son intervalle).
 */
const loadSchedules = () => {
  const file = process.env.SCHEDULES_FILE || path.join(__dirname, '..', '..', 'config', 'schedules.json');
  const schedules = JSON.parse(fs.readFileSync(file, 'utf8'));
  const disabled = (process.env.JOBS_DISABLED || '')
    .split(',')
    .map((job) => job.trim())
    .filter((job) => job.length > 0);
  return Object.entries(schedules)
    .filter(([job, definition]) => !job.startsWith('_') && definition && typeof definition.cron === 'string' && definition.enabled !== false && !disabled.includes(job))
    .map(([job, definition]) => ({ job, cron: definition.cron, description: definition.description }));
};

/** Clé entière stable pour pg_advisory_lock à partir du nom du job. */
const lockKey = (job) => {
  let hash = 0;
  for (const char of `${config.resourceUid()}:${job}`) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  }
  return hash;
};

const runWithLock = async (job) => {
  const key = lockKey(job);
  // Le verrou consultatif est tenu par la connexion d'une transaction dédiée (les verrous de session sont réentrants
  // sur une même connexion du pool, ce qui rendrait le test inefficace) ; il tombe au commit.
  const transaction = await sequelize.get().transaction();
  let locked = false;
  try {
    const [[row]] = await sequelize.get().query('SELECT pg_try_advisory_xact_lock(:key) AS locked', { replacements: { key }, transaction });
    locked = row.locked;
    if (!locked) {
      log.warn(`Job ${job} is already running (lock ${key}). Skipped.`);
      return false;
    }
    try {
      await jobRunner.runJob(job);
    } catch (err) {
      // déjà journalisé par runJob
    }
    return true;
  } finally {
    try {
      await transaction.commit();
    } catch (err) {
      log.error(`Failed to release lock of job ${job}`, err);
    }
  }
};

const startScheduler = async () => {
  const schedules = loadSchedules();
  const timezone = config.cronTimezone();
  const crons = schedules.map(({ job, cron, description }) => {
    log.info(`Schedule job ${job} with "${cron}" (${timezone})${description ? ` — ${description}` : ''}`);
    return new Cron(cron, { timezone, protect: true, catch: (err) => log.error(`Scheduled job ${job} crashed`, err) }, () => runWithLock(job));
  });
  log.info(`Scheduler started with ${crons.length} jobs`);
  return {
    jobs: schedules.map((schedule) => schedule.job),
    stop: async () => {
      crons.forEach((cron) => cron.stop());
      log.info('Scheduler stopped');
    }
  };
};

module.exports = { startScheduler, loadSchedules, runWithLock, lockKey };
