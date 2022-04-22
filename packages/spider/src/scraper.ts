import _ from 'lodash';
import * as E from 'fp-ts/Either';

import { writeCorpusJsonFile, writeCorpusTextFile, hasCorpusFile, getServiceLogger, cleanArtifactDir, asyncMapSeries } from '@watr/commonlib';

import {
  Frame
} from 'puppeteer';

import { getFetchDataFromResponse, UrlFetchData } from './url-fetch-chains';
import { createScrapingContext } from './scraping-context';
import { BrowserPool, createBrowserPool, DefaultPageInstanceOptions } from './browser-pool';
import { blockedResourceReport } from './puppet';

export interface Scraper {
  browserPool: BrowserPool;
  scrapeUrl(url: string, clean: boolean): Promise<E.Either<string, UrlFetchData>>;
  quit(): Promise<void>;
}

type InitScraperArgs = {
  sharedDataDir: string,
  corpusRoot: string
};

export async function initScraper({
  sharedDataDir,
  corpusRoot
}: InitScraperArgs): Promise<Scraper> {
  const logger = getServiceLogger('scraper');
  const browserPool = createBrowserPool('Scraper');

  return {
    browserPool,
    async scrapeUrl(url: string, clean: boolean): Promise<E.Either<string, UrlFetchData>> {
      return scrapeUrl({ browserPool, url, sharedDataDir, corpusRoot, clean });
    },
    async quit() {
      await browserPool.shutdown();
      logger.debug('Browser Pool is shutdown');
    }
  };
}

type ScrapeUrlArgs = {
  browserPool: BrowserPool,
  url: string,
  sharedDataDir: string,
  corpusRoot: string,
  clean: boolean
};

async function scrapeUrl({
  browserPool,
  url,
  sharedDataDir,
  corpusRoot,
  clean
}: ScrapeUrlArgs): Promise<E.Either<string, UrlFetchData>> {

  const scrapingContext = createScrapingContext({ initialUrl: url, sharedDataDir, corpusRoot });

  const { logger } = scrapingContext;

  const entryRootPath = scrapingContext.entryPath();

  if (clean) {
    logger.info('Cleaning old downloaded artifacts');
    cleanArtifactDir(entryRootPath);
  }

  const hasUrlFetchData = hasCorpusFile(entryRootPath, '.', 'metadata.json');

  if (hasUrlFetchData) {
    logger.warn(`skipping ${url}: metadata file exists`);
    return E.left(`skipping ${url}: metadata file exists`);
  }

  return browserPool.use(async (browserInstance) => {

    logger.info(`downloading ${url} to ${scrapingContext.entryEncPath.toPath()}`);

    // TODO use a progressive strategy to navigate urls, starting with simplest to complex
    const browserPage = await browserInstance.newPage(DefaultPageInstanceOptions);

    blockedResourceReport(logger);

    const { page } = browserPage;

    try {
      const response = await browserPage.gotoUrl(url)

      if (!response) {
        logger.warn(`no response ${url}`);
        return E.left(`no response scraping ${url}`);
      }

      const request = response.request();
      const requestHeaders = request.headers();
      writeCorpusJsonFile(entryRootPath, '.', 'request-headers.json', requestHeaders);
      logger.verbose('wrote request headers');

      const respHeaders = response.headers();
      writeCorpusJsonFile(entryRootPath, '.', 'response-headers.json', respHeaders);
      logger.verbose('wrote response headers');

      const respBuffer = await response.buffer();
      writeCorpusTextFile(entryRootPath, '.', 'response-body', respBuffer.toString());

      const frames = page.frames();
      const frameCount = frames.length;
      let frameNum = 0;
      const timeoutMS = 5000;

      const allFrameContent = await asyncMapSeries<Frame, string>(
        page.frames(),
        async (frame: Frame): Promise<string> => {
          logger.verbose(`retrieving frame content ${frameNum} of ${frameCount}`);
          const content = await new Promise<string>((resolve) => {
            let counter = 0;
            const timeout = setTimeout(function () {
              counter += 1;
              // clearImmediate(immediate);
              resolve(`timeout after ${timeoutMS}ms`);
            }, timeoutMS);

            frame.content()
              .then(c => {
                if (counter === 0) {
                  clearTimeout(timeout);
                  resolve(c[0])
                }
              }).catch(_err => {
                // Catches Target Closed errors if timeout occurs
                // console.log(`error getting frame.content(): ${err}`);
              });
          });

          frameNum += 1;
          return content;
        }
      );

      _.each(allFrameContent, (frameContent, i) => {
        if (frameContent.length > 0) {
          writeCorpusTextFile(entryRootPath, '.', `response-frame-${i}`, frameContent);
        }
      });

      const metadata = getFetchDataFromResponse(url, response);
      writeCorpusJsonFile(entryRootPath, '.', 'metadata.json', metadata);
      const status = response.status();
      await page.close();
      logger.info(`Scraped ${url}: status: ${status}`);
      const isReqEqualResponse = metadata.requestUrl === metadata.responseUrl;
      if (!isReqEqualResponse)
        logger.info(`    --> ${metadata.responseUrl}`)

      return E.right(metadata);
    } catch (error) {
      await page.close();
      const errorMsg = `Error for ${url}: ${error}`;
      logger.warn(errorMsg);
      return E.left(errorMsg);
    }
  });
}
