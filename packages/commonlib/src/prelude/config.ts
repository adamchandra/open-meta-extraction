import path from 'path';
import { makeHashEncodedPath } from '~/util/hash-encoded-paths';


export const Env = {
  AppSharePath: null,
  DBName: null,
  DBUser: null,
  DBPassword: null,
};

type EnvKey = keyof typeof Env;

export function getEnv(key: EnvKey): string | undefined {
  return process.env[key];
}

export function setEnv(key: EnvKey, value: string): void {
  process.env[key] = value;
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

export function getCorpusEntryDirForUrl(url: string): string {
  const corpusRoot = getCorpusRootDir();
  const entryEncPath = makeHashEncodedPath(url, 3);
  const entryPath = path.resolve(corpusRoot, entryEncPath.toPath());
  return entryPath;
}
