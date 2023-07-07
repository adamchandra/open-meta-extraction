// import { createPM2CliJob } from './eco-helpers';
import { createScheduledCliJob } from './eco-helpers';
import _ from 'lodash';


const apps = [
  createScheduledCliJob({ app: 'preflight-check', once: true }),

  // TODO constant job, but need to monitor and cleanup after running
  // createScheduledCliJob({ app: 'run-extraction-service', args: '--count=2 --post-results=false' }),

  // TODO: Specify whether fetch results should be recorded locally, for testing
  // TODO monitor the time it takes to make openreview rest queries
  createScheduledCliJob({ app: 'run-fetch-service', schedule: 'every 4 hours', immediate: true }),

  // UTC time = EST + 4 hours
  // createScheduledCliJob({ app: 'run-monitor-service', schedule: 'at 12:00 AM also at 12:00 PM' }),



];


module.exports = {
  apps
};
