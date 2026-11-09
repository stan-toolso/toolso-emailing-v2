const log = require('../util/log').getLogger('Job runner');
const JobType = require('../services/JobType');
const moment = require('moment-timezone');
const sequelize = require('../storage/sequelize');
const { getCachedSettings } = require('../services/SettingsService');

const jobs = {
  [JobType.scan_contact_to_update_status]: () => require('../services/jobs/scan_contact_to_update_status')(),
  [JobType.update_contacts_stats]: () => require('../services/jobs/update_contacts_stats')(),
  [JobType.check_contents_stats]: () => require('../services/jobs/check_contents_stats')(),
  [JobType.update_inscriptions_stats]: () => require('../services/jobs/update_inscriptions_stats')(),
  [JobType.check_recurrent_schedules]: () => require('../services/jobs/check_recurrent_schedules')(),
  [JobType.check_schedules_to_send]: () => require('../services/jobs/check_schedules_to_send')(),
  [JobType.check_sent_schedules]: () => require('../services/jobs/check_sent_schedules')(),
  [JobType.update_contact_event_stats_aggregates]: () => require('../services/jobs/update_contact_event_stats_aggregates')(),
  [JobType.update_contents_stats]: () => require('../services/jobs/update_contents_stats')(),
  [JobType.update_sending_configs]: () => require('../services/jobs/update_sending_configs')(),
  [JobType.update_activation_configs]: () => require('../services/jobs/update_activation_configs')(),
  [JobType.database_cleaner]: () => require('../services/jobs/database_cleaner')(),
  [JobType.update_schedules_report]: () => require('../services/jobs/update_schedules_report')(),
  [JobType.calculate_sending_strategies_stats]: () => require('../services/jobs/calculate_sending_strategies_stats')(),
  [JobType.contact_event_cleaner]: () => require('../services/jobs/contact_event_cleaner')(),
  [JobType.calculate_usages]: () => require('../services/jobs/calculate_usages')(),
  [JobType.update_adsense_incomes_yesterday]: async () => require('../services/jobs/update_adsense_incomes')(moment.tz((await getCachedSettings(['timezone'])).timezone).add(-1, 'days')),
  [JobType.update_adsense_incomes_today]: async () => require('../services/jobs/update_adsense_incomes')(moment.tz((await getCachedSettings(['timezone'])).timezone)),
  [JobType.build_model]: () => require('../services/jobs/build_model')(sequelize.get()),
  [JobType.check_schedules_missing_contents]: () => require('../services/jobs/check_schedules_missing_contents')(),
  [JobType.update_contents_stats_table]: () => require('../services/jobs/update_contents_stats_table')()
};

/**
 * Exécute un job planifié (ex-`handlers/job.js`, déclenché par EventBridge via toolso-access).
 * @param {string} jobType une valeur de JobType
 */
const runJob = async (jobType) => {
  const job = jobs[jobType];
  if (!job) {
    log.warn(`Job of type ${jobType} not implemented`);
    return;
  }
  const startTs = Date.now();
  log.info(`Execute job ${jobType}`);
  try {
    await job();
    log.info(`End job ${jobType}. Execution time ${Date.now() - startTs}ms`);
  } catch (err) {
    log.error(`Job ${jobType} failed after ${Date.now() - startTs}ms`, err);
    throw err;
  }
};

module.exports = { runJob, knownJobs: Object.keys(jobs) };
