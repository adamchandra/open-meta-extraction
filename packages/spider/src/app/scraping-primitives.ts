import _ from 'lodash';
import path from 'path';

import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import {
  Transform,
  FilterTransform,
  compose,
  through,
  tap,
  ControlInstruction,
  filter,
  SpiderEnv
} from '~/core/taskflow-defs';

import {
  PageInstanceOptions,
  DefaultPageInstanceOptions,
  BrowserPool
} from '~/core/browser-pool';

import {
  HTTPResponse
} from 'puppeteer';

import { blockedResourceReport } from '~/core/resource-blocking';
import {
  gotoUrlWithRewrites,
  writeHttpResponseBody,
  writeHttpResponseFrames,
} from './scraper';

import { UrlFetchData, getFetchDataFromResponse } from '~/core/url-fetch-chains';
import { Logger } from 'winston';
import { cleanArtifactDir, getHashEncodedPath, taskflow } from '@watr/commonlib';

export async function createSpiderEnv(
  log: Logger,
  browserPool: BrowserPool,
  corpusRoot: string,
  url: URL
): Promise<SpiderEnv> {
  const initialUrl = url.toString();
  const browserInstance = await browserPool.acquire();
  const entryEncPath = getHashEncodedPath(initialUrl);

  const entryPath = () => path.resolve(corpusRoot, entryEncPath.toPath());
  const baseEnv = taskflow.initBaseEnv(log);

  const env: SpiderEnv = {
    ...baseEnv,
    initialUrl,
    entryPath,
    entryEncPath,
    browserPool,
    browserPageCache: {},
    browserInstance,
  };

  return env;
}

export const urlFilter: (urlTest: RegExp) => FilterTransform<unknown> = (regex) => compose(
  through((_a, env) => env.initialUrl),
  filter((a: string) => regex.test(a), `url ~= m/${regex.source}/`),
);

export const scrapeUrl: (pageOpts?: PageInstanceOptions) => Transform<URL, HTTPResponse> =
  (pageOpts = DefaultPageInstanceOptions) => through((url, env) => {
    const { browserInstance, log, browserPageCache, initialUrl } = env;

    const scrapingTask: TE.TaskEither<string, HTTPResponse> = async () => {
      const pageInstance = await browserInstance.newPage(pageOpts);
      browserPageCache[initialUrl] = pageInstance;
      blockedResourceReport(pageInstance, log);
      return await gotoUrlWithRewrites(pageInstance, url.toString(), log);
    };

    return pipe(
      scrapingTask,
      TE.mapLeft((message) => {
        const ci: ControlInstruction = ['halt', message];
        return ci;
      })
    );
  });


export const httpResponseToUrlFetchData: Transform<HTTPResponse, UrlFetchData> = through((httpResponse, env) => {
  const requestUrl = env.initialUrl
  return getFetchDataFromResponse(requestUrl, httpResponse);
});


export const getHttpResponseBody: Transform<HTTPResponse, string> = through((httpResponse) => {
  return pipe(
    () => httpResponse.buffer().then(body => E.right(body.toString())),
    TE.mapLeft((msg) => ['continue', msg])
  );
});

export const writeResponseBody: Transform<HTTPResponse, HTTPResponse> = tap((httpResponse, env) => {
  const entryPath = env.entryPath();
  return writeHttpResponseBody(httpResponse, entryPath);
}, 'Writing Response Body');

export const writePageFrames: Transform<unknown, unknown> = tap((_a, env) => {
  const { browserPageCache, initialUrl, entryPath } = env;
  const page = browserPageCache[initialUrl];
  writeHttpResponseFrames(entryPath(), page)
}, 'Writing Page Frames');

export const cleanArtifacts: Transform<unknown, unknown> = tap((_a, env) => {
  const entryPath = env.entryPath();
  cleanArtifactDir(entryPath);
}, 'Cleaning Artifacts');
