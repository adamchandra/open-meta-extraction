import path from 'path';
import { makeHashEncodedPath, HashEncodedPath } from '~/util/hash-encoded-paths';
import nconf from 'nconf';
import { prettyPrint } from '..';
import fs from 'fs';

export const ENV_MODES = {
  'development': null,
  'testing': null,
  'production': null,
};

export type ENV_MODES = typeof ENV_MODES;
export type ENV_MODE = keyof ENV_MODES;

function isValidEnvMode(s: string | undefined): s is ENV_MODE {
  return s !== undefined && s in ENV_MODES;
}

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
  prettyPrint({ wd });
  const workingConf = path.join(wd, 'conf');

  nconf.file('base', { file: envFile, dir: 'conf', search: true });
  nconf.file('secrets', { file: 'config-secrets.json', dir: workingConf, search: true });

  return nconf;
}

function isFile(p: string | undefined): boolean {
  return p!==undefined && fs.existsSync(p) && fs.statSync(p).isFile();
}
function isDir(p: string | undefined): boolean {
  return p!==undefined && fs.existsSync(p) && fs.statSync(p).isDirectory()
}
export function findAncestorFile(startingDir: string, filename: string): string | undefined {
  let currDir = path.resolve(startingDir);

  if (!isDir(currDir)) {
    return;
  }

  while (currDir != '/') {
    const maybeFile = path.join(currDir, filename)
    const parentDir = path.normalize(path.join(currDir, '..'));
    // prettyPrint({ maybeFile, currDir, parentDir });
    if (isFile(maybeFile)) {
      return maybeFile;
    }
    currDir = parentDir;
  }
}

export function initConfig(): typeof nconf {
  const envMode = getEnv('NODE_ENV');
  if (!isValidEnvMode(envMode)) {
    throw new Error("NODE_ENV not set!")
  }

  const envFile = `config-${envMode}.json`;

  nconf.argv().env();

  const envPath = findAncestorFile('.', envFile);

  if (envPath) {
    nconf.file('env-conf', { file: envPath });
  }

  return nconf;
}

type EnvKey = keyof typeof Env;

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
  const config = initConfig();
  return config.get('dataRootPath');
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
