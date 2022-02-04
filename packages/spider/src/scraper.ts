import _ from 'lodash';

import * as E from 'fp-ts/Either';

import { writeCorpusJsonFile, writeCorpusTextFile, hasCorpusFile, putStrLn, getServiceLogger } from '@watr/commonlib';

import {
  HTTPResponse,
  Frame
} from 'puppeteer';

import Async from 'async';
import { logPageEvents } from './page-event';
import { getFetchDataFromResponse, UrlFetchData } from './url-fetch-chains';
import { createScrapingContext } from './scraping-context';
import { useAnonPlugin, useStealthPlugin } from './puppet';
import { BrowserPool, createBrowserPool } from './browser-pool';
import { BrowserInstance } from '.';

useStealthPlugin();
useAnonPlugin();

export interface Scraper {
  browserPool: BrowserPool;
  scrapeUrl(url: string): Promise<E.Either<string, UrlFetchData>>;
  quit(): Promise<void>;
}

export async function initScraper(): Promise<Scraper> {
  const logger = getServiceLogger('scraper');
  const browserPool = createBrowserPool(logger);

  return {
    browserPool,
    async scrapeUrl(url: string): Promise<E.Either<string, UrlFetchData>> {
      const result = await browserPool.use(async (browserInstance: BrowserInstance) => {
        return scrapeUrl(browserInstance, url);
      });
      return result;
    },
    async quit() {
      await browserPool.shutdown();
      logger.info('Browser Pool is shutdown');
    }
  };
}

async function scrapeUrl(
  browserInstance: BrowserInstance,
  url: string
): Promise<E.Either<string, UrlFetchData>> {
  const scrapingContext = createScrapingContext(url);

  const { rootLogger } = scrapingContext;
  const entryRootPath = scrapingContext.entryPath();

  rootLogger.info(`downloading ${url} to ${scrapingContext.entryEncPath.toPath()}`);

  const hasUrlFetchData = hasCorpusFile(entryRootPath, '.', 'metadata.json');

  if (hasUrlFetchData) {
    rootLogger.warn(`skipping ${url}: metadata file exists`);
    return;
  }
  const { page }  = await browserInstance.newPage();
  try {
    logPageEvents(page, scrapingContext.rootLogger);

    page.setDefaultNavigationTimeout(11_000);
    page.setDefaultTimeout(11_000);
    page.setJavaScriptEnabled(true);

    let response: HTTPResponse | null = await page.goto(url, {});

    if (!response) {
      rootLogger.info('retrying navigation to page');
      const response2 = await page
        .waitForNavigation({
          //
        })
        .catch(() => {
          //
        });
      if (response2) {
        rootLogger.info('successful retry navigation to page');
        response = response2;
      }
    }

    if (!response) {
      rootLogger.warn(`no response ${url}`);
      return;
    }

    rootLogger.info('successful navigation to page');
    const request = response.request();
    const requestHeaders = request.headers();
    writeCorpusJsonFile(entryRootPath, '.', 'request-headers.json', requestHeaders);
    rootLogger.info('wrote request headers');

    const respHeaders = response.headers();
    writeCorpusJsonFile(entryRootPath, '.', 'response-headers.json', respHeaders);
    rootLogger.info('wrote response headers');

    const respBuffer = await response.buffer();
    writeCorpusTextFile(entryRootPath, '.', 'response-body', respBuffer.toString());

    const frames = page.frames();
    const frameCount = frames.length;
    let frameNum = 0;
    const timeoutMS = 5000;

    const allFrameContent = await Async.mapSeries<Frame, string>(
      page.frames(),
      Async.asyncify(async (frame: Frame) => {
        rootLogger.info(`retrieving frame content ${frameNum} of ${frameCount}`);
        const content = await new Promise((resolve) => {
          let counter = 0;
          const timeout = setTimeout(function() {
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
      })
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
    rootLogger.info(`Scraped ${url}: status: ${status}`);
    return E.right(metadata);
  } catch (error) {
    await page.close();
    const errorMsg = `Error for ${url}: ${error}`;
    return E.left(errorMsg);
  }
}
