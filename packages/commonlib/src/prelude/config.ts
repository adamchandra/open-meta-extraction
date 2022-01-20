import path from 'path';
import { makeHashEncodedPath, HashEncodedPath } from '~/util/hash-encoded-paths';
import nconf from 'nconf';

export const Env = {
  NODE_ENV: null, // production|testing
  AppSharePath: null,
  DBName: null,
  DBUser: null,
  DBPassword: null,
};

export function initConfig(): typeof nconf {
  const envMode = getEnv('NODE_ENV');
  const envFile = `config-${envMode}.json`;

  nconf.file({ file: envFile, dir: 'conf', search: true });

  nconf.env().argv();
  // nconf.defaults({});

  return nconf;
}


type EnvKey = keyof typeof Env;

function getEnv(key: EnvKey): string | undefined {
  return process.env[key];
}

function setEnv(key: EnvKey, value: string): void {
  process.env[key] = value;
}

// export function initConfig() {
//   const isLoaded = process.env['configInit'] != undefined;
//   if (isLoaded) {
//     return;
//   }
//   const runMode = getEnv('RunMode');
//   const envFile = `.env-${runMode}`;
//   const envResolved = path.resolve(envFile);
//   if (fs.existsSync(envResolved)) {
//     process.env['configFile'] = envResolved;
//     const conf = dotenv.config({ path: envResolved });
//     process.env['configState'] = 'loaded';
//     if (conf.parsed !== undefined) {
//       const parsed = conf.parsed;
//       process.env['configState'] = 'parsed';
//       parsed
//     }
//     if (conf.error) {
//       process.env['configState'] = 'error';
//       console.log(conf.error);
//     }
//   }
//   process.env['configInit'] = 'okay';
// }

// Root directory for storing application data
export function getAppSharedDir(): string {
  const appSharePath = getEnv('AppSharePath');
  const workingDir = appSharePath || 'app-share.d';
  return workingDir;
}

// The root directory in which the spider will download files
export function getCorpusRootDir(): string {
  const shareDir = getAppSharedDir();
  const corpusRoot = path.join(shareDir, 'corpus-root.d');
  return path.resolve(corpusRoot);
}

export function getHashEncodedPath(url: string): HashEncodedPath {
  return makeHashEncodedPath(url, 3);
}
export function getCorpusEntryDirForUrl(url: string): string {
  const corpusRoot = getCorpusRootDir();
  const entryEncPath = getHashEncodedPath(url);
  const entryPath = path.resolve(corpusRoot, entryEncPath.toPath());
  return entryPath;
}
