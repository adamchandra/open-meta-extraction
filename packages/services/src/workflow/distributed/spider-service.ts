import { Logger } from 'winston';
import * as E from 'fp-ts/Either';

import {
  BrowserPool,
  createBrowserPool,
  initScraper,
  Scraper,
  UrlFetchData,
} from '@watr/spider';

import {
  getCorpusEntryDirForUrl,
  getServiceLogger
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
  readUrlFetchData,
} from '@watr/field-extractors';


export interface SpiderService {
  scraper: Scraper;
  log: Logger;
  browserPool: BrowserPool;
  scrape(url: string): Promise<UrlFetchData | undefined>;
  scrapeUrl(arg: { url: string }): Promise<UrlFetchData | undefined>;
  quit(): Promise<void>;

  networkReady: CustomHandler<SpiderService, unknown, unknown>;
  startup: CustomHandler<SpiderService, unknown, unknown>;
  shutdown: CustomHandler<SpiderService, unknown, unknown>;
  extractFields: CustomHandler<SpiderService, { url: string }, void>;
}

export async function createSpiderService(commLink: CommLink<SatelliteService<SpiderService>>): Promise<SpiderService> {
  const logger = commLink.log;

  const scraper = await initScraper();
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

    async scrapeUrl(arg: { url: string }): Promise<UrlFetchData | undefined> {
      const fetchData: UrlFetchData | undefined = await this.scrape(arg.url)
        .catch((error: Error) => {
          logger.error(`${error.name}: ${error.message}`);
          return undefined;
        });
      return fetchData;
    },

    async scrape(url: string): Promise<UrlFetchData | undefined> {
      return scraper.scrapeUrl(url)
        .then(resultOrError => {
          return E.match(
            (_err: string) => {
              console.warn('Scraping Result', _err);
              return undefined;
            },
            (succ: UrlFetchData) => succ
          )(resultOrError);
        });
    },
    async extractFields(arg): Promise<void> {
      const entryPath = getCorpusEntryDirForUrl(arg.url);
      const urlFetchData = readUrlFetchData(entryPath);
      const { log, browserPool } = this;
      const sharedEnv = {
        log,
        browserPool,
        urlFetchData
      }
      const exEnv = await initExtractionEnv(entryPath, sharedEnv);
      await extractFieldsForEntry(exEnv);
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
