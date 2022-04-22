import path from 'path';

import { Logger } from 'winston';
import {
  HashEncodedPath,
  getHashEncodedPath,
  getServiceLogger
} from '@watr/commonlib';

export interface ScrapingContext {
  sharedDataDir: string;
  corpusRoot: string;
  initialUrl: string;
  entryEncPath: HashEncodedPath;
  entryPath(): string;
  logger: Logger;
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
  const entryEncPath = getHashEncodedPath(initialUrl);
  const logger = getServiceLogger('scraper')

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
    logger
  };
}
