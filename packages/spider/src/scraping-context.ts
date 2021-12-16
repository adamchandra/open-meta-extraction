import path from 'path';

import { Logger } from 'winston';
import {
  consoleTransport,
  fileTransport,
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
  const appShareDir = getAppSharedDir();
  const corpusRoot = getCorpusRootDir();
  const entryLoggingPath = path.resolve(corpusRoot, entryEncPath.toPath());

  const loglevel = 'info';
  const rootLogger = newLogger(
    consoleTransport(loglevel),
    fileTransport(appShareDir, 'spidering-root.log', loglevel)
  );

  const entryLogger = newLogger(
    consoleTransport(loglevel),
    fileTransport(entryLoggingPath, 'spidering-entry.log', loglevel)
  );

  return {
    rootLogger,
    entryLogger
  };
}

export function createScrapingContext(
  initialUrl: string,
): ScrapingContext {
  const sharedDataDir = getAppSharedDir();
  const corpusRoot = getCorpusRootDir();

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

