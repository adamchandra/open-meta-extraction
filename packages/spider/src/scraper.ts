import _ from 'lodash';
import { writeCorpusJsonFile, writeCorpusTextFile, hasCorpusFile, putStrLn } from '@watr/commonlib';

import {
  HTTPResponse,
  Page,
  Browser,
  Frame
} from 'puppeteer';

import Async from 'async';
import { logPageEvents } from './page-event';
import { getFetchDataFromResponse, UrlFetchData } from './url-fetch-chains';
import { createScrapingContext } from './scraping-context';
import { launchBrowser, useAnonPlugin, useStealthPlugin } from './puppet';

useStealthPlugin();
useAnonPlugin();

export interface Scraper {
  browser: Browser;
  scrapeUrl(url: string): Promise<UrlFetchData | undefined>;
  quit(): Promise<void>;
}

export async function initScraper(
): Promise<Scraper> {
  const browser = await launchBrowser();

  return {
    browser,
    async scrapeUrl(url: string) {
      return scrapeUrl(browser, url);
    },
    async quit() {
      // browser.disconnect();

      return browser.close()
        .then(() => putStrLn('Browser is closed'));
    }
  };
}

async function scrapeUrl(
  browser: Browser,
  url: string
): Promise<UrlFetchData | undefined> {
  const scrapingContext = createScrapingContext(url);

  const { rootLogger } = scrapingContext;
  const entryRootPath = scrapingContext.entryPath();

  rootLogger.info(`downloading ${url} to ${scrapingContext.entryEncPath.toPath()}`);

  const hasUrlFetchData = hasCorpusFile(entryRootPath, '.', 'metadata.json');

  if (hasUrlFetchData) {
    rootLogger.warn(`skipping ${url}: metadata file exists`);
    return;
  }
  const page: Page = await browser.newPage();
  try {
    logPageEvents(scrapingContext, page);

    page.setDefaultNavigationTimeout(11_000);
    page.setDefaultTimeout(11_000);
    page.setJavaScriptEnabled(true);

    let response: HTTPResponse | null = await page.goto(url, {});

    if (!response) {
      rootLogger.info('retrying navigation to page');
      const response2 = await page
        .waitForNavigation({
          // waitUntil: [ ]
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
        let content = '';

        try {
          Async.race([
            function(callback) {
              setTimeout(function() {
                callback(null, [`timeout after ${timeoutMS}ms`]);
              }, timeoutMS);
            },
            function(callback) {
              frame.content()
                .then(c => callback(null, c))
            }
          ], (err, contents) => {
            console.log({ contents, err });
            content = contents[0];
          });
        } catch (error) {
          rootLogger.info(`error retrieving frame content ${frameNum} of ${frameCount}`);
          rootLogger.info(`   ${error}`);
        }
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
    return metadata;
  } catch (error) {
    await page.close();
    rootLogger.error(`For ${url}: error: ${error}`);
  }
  return undefined;
}

export async function scrapeUrlAndQuit(
  url: string
): Promise<void> {
  const browser = await launchBrowser();
  await scrapeUrl(browser, url);
  await browser.close();
}
