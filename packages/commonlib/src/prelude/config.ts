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
  console.log(`initConfig(file=conf/${envFile})`)

  nconf.file({ file: envFile, dir: 'conf', search: true });

  nconf.env().argv();
  // nconf.defaults({});

  return nconf;
}


type EnvKey = keyof typeof Env;

function getEnv(key: EnvKey): string | undefined {
  return process.env[key];
}

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
