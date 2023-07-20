import _ from 'lodash';

import * as TE from 'fp-ts/TaskEither';
import { prettyPrint, putStrLn } from '@watr/commonlib';

import {
  compose,
  ExtractionEnv,
} from '~/predef/extraction-prelude';

import {
  initExtractionEnv
} from '~/core/extraction-primitives';

import { HTTPResponse } from 'puppeteer';

import {
  ScriptablePageInstanceOptions,
  spiderTaskflow as sfp,
  scrapingPrimitives as spPrim,
  scrapingTaskflow as stflow,
  UrlFetchData,
  urlFilterAny,

} from '@watr/spider';


const emptyUrlFetchData: UrlFetchData = {
  responseUrl: '',
  fetchChain: [],
  requestUrl: '',
  status: '',
  timestamp: ''
};


type Transform<A, B> = stflow.Transform<A, B>

const {
  eachOrElse,
  mapEnv,
  through
} = sfp;

const {
  fetchUrl,
  httpResponseToUrlFetchData,
  writeResponseBody,
  writePageFrames,
  cleanArtifacts,
} = spPrim;

// Hard-code a few URLs that require js to run to retrieve metadata
const allowJSInBrowserUrls = [
  /linkinghub.elsevier.com/,
  /aaai.org/
];

const linkinghubSpideringRule: Transform<URL, HTTPResponse> = compose(
  urlFilterAny(allowJSInBrowserUrls),
  fetchUrl(ScriptablePageInstanceOptions),
)

const defaultSpideringRule: Transform<URL, HTTPResponse> = compose(
  fetchUrl(),
)

const SpideringUrlSpecificAttempts: Transform<URL, HTTPResponse> = eachOrElse(
  linkinghubSpideringRule,
  defaultSpideringRule
)

export const SpiderToExtractionEnv = mapEnv<UrlFetchData, ExtractionEnv>(
  (env) => initExtractionEnv(env, emptyUrlFetchData),
  (env, urlFetchData) => initExtractionEnv(env, urlFetchData)
);

export const SpideringPipeline: Transform<URL, UrlFetchData> = compose(
  cleanArtifacts(),
  SpideringUrlSpecificAttempts,
  writeResponseBody,
  writePageFrames(),
  httpResponseToUrlFetchData,
);

export const FakeSpideringPipeline: Transform<URL, UrlFetchData> = compose(
  through((sdf) => {
    prettyPrint({ sdf });
    const dummy: UrlFetchData = {
      responseUrl: '',
      requestUrl: '',
      status: '',
      timestamp: '',
      fetchChain: [
        {
          requestUrl: '',
          status: '',
          timestamp: ''
        }
      ]
    };
    return TE.right(dummy);
  }),
  cleanArtifacts(),
);
