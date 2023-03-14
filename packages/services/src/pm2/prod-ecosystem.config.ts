import { pm2CliJob } from './eco-helpers';
import _ from 'lodash';

const apps = [
  pm2CliJob('run-extraction-service', { args: '--post-results' }),
  pm2CliJob('run-fetch-service'),
  pm2CliJob('scheduler'),
  pm2CliJob('preflight-check', { autorestart: false })
];

module.exports = {
  apps
};
