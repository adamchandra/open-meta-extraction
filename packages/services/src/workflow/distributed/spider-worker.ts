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
import { defineSatelliteService } from '@watr/commlinks';

export interface SpiderService {
  crawlScheduler: CrawlScheduler;
  scraper: Scraper;
  run(alphaRecordStream: Readable): Promise<Readable>; // Readable<UrlFetchData|undefined>
  scrape(url: string): Promise<UrlFetchData | undefined>;
  quit(): Promise<void>;
}

export async function createSpiderService(): Promise<SpiderService> {
  const logger = getServiceLogger('spider');

  const scraper = await initScraper();

  const crawlScheduler = initCrawlScheduler();

  const service: SpiderService = {
    scraper,
    crawlScheduler,
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

export const Spider = defineSatelliteService<SpiderService>(
  'Spider',
  async () => createSpiderService(), {

  async scrapeUrl(arg: { url: string }): Promise<UrlFetchData | undefined> {
    const spider = this.cargo;
    const fetchData: UrlFetchData | undefined = await spider
      .scrape(arg.url)
      .catch((error: Error) => {
        this.log.error(`${error.name}: ${error.message}`);
        return undefined;
      });
    return fetchData;
  },

  async scrapeUrls() {
    // const spider = this.cargo;
    // let nextUrl = await getNextUrlForSpidering();
    // while (nextUrl !== undefined) {
    //   const metadata = await spider
    //     .scrape(nextUrl)
    //     .catch((error: Error) => {
    //       this.log.error('Error', error.name, error.message);
    //       return undefined;
    //     });

    //   if (metadata !== undefined) {
    //     const committedMeta = await commitMetadata(metadata);
    //     this.log.info(`committing Metadata ${committedMeta}`)
    //     if (committedMeta) {
    //       committedMeta.statusCode === 'http:200';
    //       const corpusEntryStatus = await insertCorpusEntry(committedMeta.url);
    //       this.log.info(`created new corpus entry ${corpusEntryStatus.entryId}: ${corpusEntryStatus.statusCode}`)
    //       // await this.commLink.echoBack('step');
    //     }
    //   } else {
    //     this.log.warn(`Metadata is undefined for url ${nextUrl}`);
    //   }
    //   nextUrl = await getNextUrlForSpidering();
    // }
  },

  async networkReady() { },
  async startup() { },
  async shutdown() {
    const spider = this.cargo;
    return spider.scraper.quit()
      .then(() => {
        this.log.debug(`${this.serviceName} [scraper:shutdown]> `)
      });
  }
});

