import _ from 'lodash';
import { prettyPrint, putStrLn } from '@watr/commonlib';
import { createScheduledCliJob } from './eco-helpers';

const isDryRun = process.env.DRY_RUN;

const appNames: string[] = [
  'Howard',
  'Aaron',
  'Martha'
];

const apps1 = appNames.map((name, i) => {
  return createScheduledCliJob({ app: 'echo', args: `--message='Hello from ${name}, dry=${isDryRun}'`, schedule: 'every 3 seconds', appNameSuffix: `${i}` });
});

// const apps2 = [
//   createScheduledCliJob({ app: 'echo', args: `--message='Hello from ${name}, dry=${isDryRun}'`, schedule: 'every 3 seconds', appNameSuffix: `#${i}`});
// ];

// const apps = _.concat(apps1, apps2);

prettyPrint({ apps1 });

module.exports = {
  apps: apps1
};
