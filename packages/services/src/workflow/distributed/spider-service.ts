import { Logger } from 'winston';
import * as E from 'fp-ts/Either';

import {
  BrowserPool,
  initScraper,
  Scraper,
  UrlFetchData,
} from '@watr/spider';

import {
  getCorpusRootDir,
} from '@watr/commonlib';

import {
  CommLink,
  CustomHandler,
  defineSatelliteService,
  SatelliteService
} from '@watr/commlinks';

import {
  extractFieldsForEntry,
  initExtractionEnv,
} from '@watr/field-extractors';

import { ExtractionSharedEnv } from '@watr/field-extractors';

export interface SpiderService {
  scraper: Scraper;
  log: Logger;
  browserPool: BrowserPool;

  networkReady: CustomHandler<SpiderService, unknown, unknown>;
  startup: CustomHandler<SpiderService, unknown, unknown>;
  shutdown: CustomHandler<SpiderService, unknown, unknown>;
  quit(): Promise<void>;

  scrapeAndExtract(url: string): Promise<UrlFetchData | undefined>;
}

export async function createSpiderService(commLink: CommLink<SatelliteService<SpiderService>>): Promise<SpiderService> {
  const logger = commLink.log;
  const corpusRoot = getCorpusRootDir();

  const scraper = await initScraper({ corpusRoot });
  const { browserPool } = scraper;

  const service: SpiderService = {
    log: logger,
    scraper,
    browserPool,

    async networkReady() { },
    async startup() { },
    async shutdown() {
      return this.scraper.quit();
    },

    async scrapeAndExtract(url: string): Promise<UrlFetchData | undefined> {
      const { log, browserPool } = this;
      const scrapedUrl = await scraper.scrapeUrl(url, true);

      if (E.isRight(scrapedUrl)) {
        log.info('Field Extraction starting..')
        const urlFetchData = scrapedUrl.right;
        const sharedEnv: ExtractionSharedEnv = {
          log,
          browserPool,
          urlFetchData
        };

        const entryPath = scraper.getUrlCorpusEntryPath(url);
        const exEnv = await initExtractionEnv(entryPath, sharedEnv);
        await extractFieldsForEntry(exEnv);
        return urlFetchData;
      }
    },

    quit() {
      return scraper.quit();
    }
  };

  return service;
}

export const SpiderService = defineSatelliteService<SpiderService>(
  'SpiderService', (commLink) => createSpiderService(commLink)
);
