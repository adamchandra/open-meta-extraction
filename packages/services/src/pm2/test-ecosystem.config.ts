// import { prettyPrint } from '@watr/commonlib';
import { appDef } from './eco-helpers';

const cliScript = './dist/src/cli/index.js'

const appNames: string[] = [
  'Howard',
  'Aaron',
  'Martha'
];

const apps = appNames.map(name => appDef(name, cliScript, `echo --message='Hello from ${name}'`));

const sitter = appDef('PM2Sitter', cliScript, 'pm2-sitter --watch ".sentinel.tmp"')
apps.push(sitter);

// prettyPrint({ apps });

module.exports = {
  apps
};
