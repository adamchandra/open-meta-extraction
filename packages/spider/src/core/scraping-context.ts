import path from 'path';

import { Logger } from 'winston';
import {
  HashEncodedPath,
  getHashEncodedPath,
  getServiceLogger
} from '@watr/commonlib';

export interface ScrapingContext {
  corpusRoot: string;
  initialUrl: string;
  entryEncPath: HashEncodedPath;
  entryPath(): string;
  logger: Logger;
}

type Args = {
  initialUrl: string,
  corpusRoot: string
};

export function createScrapingContext({
  initialUrl,
  corpusRoot
}: Args): ScrapingContext {
  const entryEncPath = getHashEncodedPath(initialUrl);
  const logger = getServiceLogger('scraper');

  return {
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
