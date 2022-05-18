import { pm2CliJob } from './eco-helpers';
import _ from 'lodash';


const apps = [
  pm2CliJob('run-relay-extract'),
  pm2CliJob('run-relay-fetch'),
  pm2CliJob('scheduler'),
  pm2CliJob('preflight-check', { autorestart: false })
];


module.exports = {
  apps
};
