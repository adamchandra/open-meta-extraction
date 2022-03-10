import path from 'path';
import { makeHashEncodedPath, HashEncodedPath } from '~/util/hash-encoded-paths';
import nconf from 'nconf';
import { prettyPrint } from '..';

export const Env = {
  NODE_ENV: null, // production|testing
  AppSharePath: null,
  DBName: null,
  DBUser: null,
  DBPassword: null,
};

export function configureApp(): typeof nconf {
  const envMode = getEnv('NODE_ENV');
  const envFile = `config-${envMode}.json`;

  nconf.argv().env();
  nconf.required(['workingDirectory']);

  const wd = nconf.get('workingDirectory');
  prettyPrint({ wd  });
  const workingConf = path.join(wd, 'conf');

  nconf.file('base', { file: envFile, dir: 'conf', search: true });
  nconf.file('secrets', { file: 'config-secrets.json', dir: workingConf, search: true });

  return nconf;
}

export function initConfig(): typeof nconf {
  const envMode = getEnv('NODE_ENV');
  const envFile = `config-${envMode}.json`;

  nconf.argv().env();

  nconf.file('conf-1', { file: path.join('..', envFile)  });
  nconf.file('conf-2', { file: path.join('../..', envFile)  });
  nconf.file('conf-3', { file: path.join('../../..', envFile)  });

  nconf.file('base', { file: envFile, dir: 'conf', search: true });

  return nconf;
}


type EnvKey = keyof typeof Env;

const runtimeConfig = initConfig();

export function getEnvMode(): string {
  const env = getEnv('NODE_ENV');
  return `${env}`;
}
export function isTestingEnv(): boolean {
  return getEnv('NODE_ENV') === 'testing';
}

function getEnv(key: EnvKey): string | undefined {
  return process.env[key];
}

// Root directory for storing application data
export function getAppSharedDir(): string {
  return runtimeConfig.get('dataRootPath');
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
