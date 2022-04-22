import path from 'path';

import { Logger } from 'winston';
import {
  newConsoleTransport,
  newFileTransport,
  getAppSharedDir,
  getCorpusRootDir,
  HashEncodedPath,
  newLogger,
  getHashEncodedPath
} from '@watr/commonlib';

export interface ScrapingContext extends SpiderLoggers {
  sharedDataDir: string;
  corpusRoot: string;
  initialUrl: string;
  entryEncPath: HashEncodedPath;
  entryPath(): string;
}

export interface SpiderLoggers {
  rootLogger: Logger;
  entryLogger: Logger;
}

export function getSpiderLoggers(
  entryEncPath: HashEncodedPath
): SpiderLoggers {
  // const appShareDir = getAppSharedDir();
  // const corpusRoot = getCorpusRootDir();
  // const entryLoggingPath = path.resolve(corpusRoot, entryEncPath.toPath());

  const loglevel = 'info';
  const rootLogger = newLogger(
    newConsoleTransport(loglevel),
    // newFileTransport(appShareDir, 'spidering-root.log', loglevel)
  );

  const entryLogger = newLogger(
    newConsoleTransport(loglevel),
    // newFileTransport(entryLoggingPath, 'spidering-entry.log', loglevel)
  );

  return {
    rootLogger,
    entryLogger
  };
}

type Args = {
  initialUrl: string,
  sharedDataDir: string,
  corpusRoot: string
};
export function createScrapingContext({
  initialUrl,
  sharedDataDir,
  corpusRoot
}: Args): ScrapingContext {
  // const sharedDataDir = getAppSharedDir();
  // const corpusRoot = getCorpusRootDir();

  const entryEncPath = getHashEncodedPath(initialUrl);
  const spiderLoggers = getSpiderLoggers(entryEncPath);
  return {
    sharedDataDir,
    corpusRoot,
    entryEncPath,
    initialUrl,
    entryPath(): string {
      const entryPath = path.resolve(
        this.corpusRoot,
        this.entryEncPath.toPath()
      );
      return entryPath;
    },
    ...spiderLoggers
  };
}
