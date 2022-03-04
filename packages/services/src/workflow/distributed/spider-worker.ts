import { Readable } from 'stream';

import {
  initScraper,
  Scraper,
  UrlFetchData,
  CrawlScheduler,
  initCrawlScheduler
} from '@watr/spider';

import {
  streamPump,
  delay,
  getServiceLogger
} from '@watr/commonlib';

import * as E from 'fp-ts/Either';
import { CustomHandler, defineSatelliteService } from '@watr/commlinks';

export interface SpiderService {
  crawlScheduler: CrawlScheduler;
  scraper: Scraper;
  run(alphaRecordStream: Readable): Promise<Readable>; // Readable<UrlFetchData|undefined>
  scrape(url: string): Promise<UrlFetchData | undefined>;
  scrapeUrl(arg: { url: string }): Promise<UrlFetchData | undefined>;
  quit(): Promise<void>;

  networkReady: CustomHandler<SpiderService, unknown, unknown>;
  startup: CustomHandler<SpiderService, unknown, unknown>;
  shutdown: CustomHandler<SpiderService, unknown, unknown>;
}

export async function createSpiderService(): Promise<SpiderService> {
  const logger = getServiceLogger('spider');

  const scraper = await initScraper();

  const crawlScheduler = initCrawlScheduler();

  const service: SpiderService = {
    scraper,
    crawlScheduler,

  async networkReady() { },
  async startup() { },
  async shutdown() {
    return this.scraper.quit();
  },

    async scrapeUrl(arg: { url: string }): Promise<UrlFetchData | undefined> {
      // const spider = this.cargo;
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
    async run(alphaRecordStream: Readable): Promise<Readable> {
      const urlCount = await crawlScheduler.addUrls(alphaRecordStream);
      const seedUrlStream = crawlScheduler.getUrlStream();
      let i = 0;
      return streamPump.createPump()
        .viaStream<string>(seedUrlStream)
        .throughF(async (urlString) => {
          logger.debug(`url ${i} of ${urlCount}`);
          i += 1;
          return scraper.scrapeUrl(urlString)
            .then((didScrape) => {
              if (didScrape) {
                return delay(1000);
              }
            })
            .catch((error) => logger.warn('Error', error))
            ;
        })
        .toReadableStream();
    },
    quit() {
      return scraper.quit();
    }
  };

  return service;
}

export const SpiderService = defineSatelliteService<SpiderService>(
  'SpiderService', () => createSpiderService()
);
