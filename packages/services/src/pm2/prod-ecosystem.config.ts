import _ from 'lodash';
import { createScheduledCliJob } from './eco-helpers';

// TODO env.dryrun to start everything but not make state changes...
const isDryRun = process.env.DRY_RUN;
if (isDryRun) {}
const apps = [

  // TODO constant job, but need to monitor and cleanup after running
  createScheduledCliJob({ app: 'run-extraction-service', args: '--post-results' }),

  // TODO: Specify whether fetch results should be recorded locally, for testing
  createScheduledCliJob({ app: 'run-fetch-service', schedule: 'every 4 hours', immediate: true }),
  // UTC time = EST + 4 hours
  createScheduledCliJob({ app: 'run-monitor-service', schedule: 'at 12:00 AM also at 12:00 PM' }),

  // TODO specify dependency between check and other services?
  // Solution: start ecosystem with only check running, then have it start other apps iff okay
  createScheduledCliJob({ app: 'preflight-check' }),
];

module.exports = {
  apps
};
