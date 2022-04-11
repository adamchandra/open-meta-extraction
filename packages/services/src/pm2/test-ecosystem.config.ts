import { appDef, CLIAppDef, makeCLIEcosystem } from './eco-helpers';

const cliScript = './dist/src/cli/index.js'

const appNames: string[] = [
  'Howard',
  'Aaron',
  'Martha'
];

const appDefs: CLIAppDef[] = appNames.map(name => ({
  name,
  args: `echo --message='Hello from ${name}'`
}));

const apps = makeCLIEcosystem(appDefs)
// const apps = appNames.map(name => appDef(name, cliScript, `echo --message='Hello from ${name}'`));

const sitter = appDef('PM2Sitter', cliScript, 'pm2-sitter --watch ".sentinel.tmp"')
apps.push(sitter);


module.exports = {
  apps
};
