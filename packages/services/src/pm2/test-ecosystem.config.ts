import { pm2CliJob } from './eco-helpers';
import _ from 'lodash';

const appNames: string[] = [
  'Howard',
  'Aaron',
  'Martha'
];

const apps1 = appNames.map(name => {
  return pm2CliJob('echo', { name: `Say ${name}`, args: `--message='Hello from ${name}' --interval 1000` });
});

const apps2 = [
  pm2CliJob('scheduler'),
  pm2CliJob('preflight-check', { autorestart: false })
];

const apps = _.concat(apps1, apps2)

module.exports = {
  apps
};
