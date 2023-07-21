// import { createPM2CliJob } from './eco-helpers';
import _ from 'lodash';
import { createDirectCliJob, createScheduledCliJob } from './eco-helpers';


const apps = [
  createScheduledCliJob({ app: 'preflight-check', once: true }),

  // TODO constant job, but need to monitor and cleanup after running
  // createScheduledCliJob({ app: 'run-extraction-service', args: '--count=2 --post-results=false' }),

  // TODO: Specify whether fetch results should be recorded locally, for testing
  // TODO monitor the time it takes to make openreview rest queries
  createDirectCliJob('run-fetch-service', '--limit=20'),
  createDirectCliJob('run-extraction-service', '--post-results=false --limit=10'),

  // UTC time = EST + 4 hours
  // createScheduledCliJob({ app: 'run-monitor-service', schedule: 'at 12:00 AM also at 12:00 PM' }),


];


module.exports = {
  apps
};
