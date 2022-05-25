import _ from 'lodash';
import * as E from 'fp-ts/Either';
import path from 'path';

import { writeCorpusJsonFile, writeCorpusTextFile, hasCorpusFile, getServiceLogger, cleanArtifactDir, asyncMapSeries, getHashEncodedPath } from '@watr/commonlib';

import {
  Frame, HTTPResponse
} from 'puppeteer';

import { getFetchDataFromResponse, UrlFetchData } from './url-fetch-chains';
import { createScrapingContext } from './scraping-context';
import { BrowserPool, createBrowserPool, DefaultPageInstanceOptions, PageInstance } from './browser-pool';
import { blockedResourceReport } from './resource-blocking';
import { Logger } from 'winston';

export interface Scraper {
  browserPool: BrowserPool;
  scrapeUrl(url: string, clean: boolean): Promise<E.Either<string, UrlFetchData>>;
  getUrlCorpusEntryPath(url: string): string;
  quit(): Promise<void>;
}

type InitScraperArgs = {
  corpusRoot: string,
};

export async function initScraper({
  corpusRoot
}: InitScraperArgs): Promise<Scraper> {
  const logger = getServiceLogger('scraper');
  const browserPool = createBrowserPool('Scraper');

  return {
    browserPool,
    async scrapeUrl(url: string, clean: boolean): Promise<E.Either<string, UrlFetchData>> {
      return scrapeUrl({ browserPool, url, corpusRoot, clean });
    },
    getUrlCorpusEntryPath(url: string): string {
      const entryEncPath = getHashEncodedPath(url);
      return path.resolve(corpusRoot, entryEncPath.toPath());
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
  corpusRoot: string,
  clean: boolean
};


async function gotoUrlWithRewrites(
  pageInstance: PageInstance,
  url: string,
  logger: Logger,
): Promise<E.Either<string, HTTPResponse>> {
  const urlRewrites = pageInstance.opts.rewriteableUrls;
  const response = await pageInstance.gotoUrl(url);
  if (E.isLeft(response)) {
    const error = response.left;
    logger.debug(`Attempting Rewrite for ${error}`);
    const msg = error;
    const maybeRewrite = _.map(urlRewrites, (rule) => {
      if (rule.regex.test(msg)) {
        const newUrl = rule.rewrite(msg);
        logger.verbose(`    new url: ${newUrl}`);
        return newUrl;
      }
    });
    const rw0 = maybeRewrite.filter(s => s !== undefined);
    logger.verbose(`    available rewrites: ${rw0.join(', ')}`);
    if (rw0.length > 0) {
      const rewrite = rw0[0];
      if (rewrite === undefined) return E.left('no rewrites available');
      logger.info(`Rewrote ${url} to ${rewrite}`)
      return gotoUrlWithRewrites(pageInstance, rewrite, logger)
    }
  }
  return response;
}

async function scrapeUrl({
  browserPool,
  url,
  corpusRoot,
  clean
}: ScrapeUrlArgs): Promise<E.Either<string, UrlFetchData>> {

  const scrapingContext = createScrapingContext({ initialUrl: url, corpusRoot });

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

    const pageInstance = await browserInstance.newPage(DefaultPageInstanceOptions);

    blockedResourceReport(pageInstance, logger);

    try {
      const maybeResponse = await gotoUrlWithRewrites(pageInstance, url, logger);

      if (E.isLeft(maybeResponse)) {
        const msg = maybeResponse.left;
        logger.warn(`no response ${url}: ${msg}`);
        return E.left(`no response scraping ${url}: ${msg}`);
      }

      const response = maybeResponse.right;

      const { page } = pageInstance;
      const metadata = getFetchDataFromResponse(url, response);
      await writeRequestToDisk(response, entryRootPath, logger, pageInstance, metadata);
      const status = response.status();
      await page.close();
      logger.info(`Scraped ${url}: status: ${status}`);
      const isReqEqualResponse = metadata.requestUrl === metadata.responseUrl;
      if (!isReqEqualResponse)
        logger.info(`    --> ${metadata.responseUrl}`)

      return E.right(metadata);
    } catch (error) {
      await pageInstance.page.close();
      const errorMsg = `Error for ${url}: ${error}`;
      logger.warn(errorMsg);
      return E.left(errorMsg);
    }
  });
}

async function writeRequestToDisk(
  response: HTTPResponse,
  entryRootPath: string,
  logger: Logger,
  pageInstance: PageInstance,
  urlFetchData: UrlFetchData
): Promise<void> {
  const request = response.request();
  const requestHeaders = request.headers();
  writeCorpusJsonFile(entryRootPath, '.', 'request-headers.json', requestHeaders);
  logger.verbose('wrote request headers');

  const respHeaders = response.headers();
  writeCorpusJsonFile(entryRootPath, '.', 'response-headers.json', respHeaders);
  logger.verbose('wrote response headers');

  const respBuffer = await response.buffer();
  writeCorpusTextFile(entryRootPath, '.', 'response-body', respBuffer.toString());

  const { page } = pageInstance;
  const frames = page.frames();
  const frameCount = frames.length;
  let frameNum = 0;
  const timeoutMS = 5000;

  const allFrameContent = await asyncMapSeries<Frame, string>(
    frames,
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

  writeCorpusJsonFile(entryRootPath, '.', 'metadata.json', urlFetchData);
}
