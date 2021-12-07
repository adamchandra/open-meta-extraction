import { Logger } from 'winston';
import path from 'path';
import { consoleTransport, fileTransport, getAppSharedDir, getCorpusRootDir, HashEncodedPath, newLogger } from '@watr/commonlib';


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
    fileTransport(appShareDir, 'spidering-log.json', loglevel)
  );

  const entryLogger = newLogger(
    consoleTransport(loglevel),
    fileTransport(entryLoggingPath, 'entry-log.json', loglevel)
  );

  return {
    rootLogger,
    entryLogger
  };
}
