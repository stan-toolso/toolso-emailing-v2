#!/usr/bin/env node
/**
 * Exécute un job planifié à la main (ex-`do_execute_job.js`) :
 *   node scripts/run-job.js check_schedules_to_send
 */
require('dotenv').config();
const log = require('../src/util/log').getLogger('RunJob');

(async () => {
  const jobType = process.argv[2];
  const { knownJobs, runJob } = require('../src/jobs/runJob');
  if (!jobType || !knownJobs.includes(jobType)) {
    console.error(`Usage: node scripts/run-job.js <job>\nJobs: ${knownJobs.join(', ')}`);
    process.exit(2);
  }
  const sequelizeModule = require('../src/storage/sequelize');
  try {
    await sequelizeModule.initWithPostgresql(10);
    await runJob(jobType);
    await sequelizeModule.close();
    process.exit(0);
  } catch (err) {
    log.error('Job failed', err);
    process.exit(1);
  }
})();
