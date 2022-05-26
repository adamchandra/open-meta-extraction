import _ from 'lodash';

import {
  attemptEach,
  compose,
  // ExtractionRule,
  Transform,
  // mapEnv,
  // SpiderToExtractionEnvTransform,
  ExtractionEnv,
} from '~/predef/extraction-prelude';

import {
  summarizeEvidence,
  checkStatusAndNormalize,
  // urlFilter,
  initExtractionEnv
} from '~/core/extraction-primitives';

import { UrlSpecificAttempts } from './url-specific-rules';
import { GeneralExtractionAttempts } from './non-specific-rules';


import {
  // createSpiderEnv,
  // getHttpResponseBody,
  httpResponseToUrlFetchData,
  // scrapeUrl,
  ScriptablePageInstanceOptions,
  writeResponseBody,
  spiderTaskflow as sfp,
  scrapingPrimitives as spPrim,
  scrapingTaskflow as stflow,
  // SpiderEnv,
  ExtractionRule as SPExtractionRule,
  UrlFetchData
} from '@watr/spider';
import { HTTPResponse } from 'puppeteer';


export const AbstractFieldAttempts: Transform<unknown, unknown> = compose(
  checkStatusAndNormalize,
  attemptEach(
    UrlSpecificAttempts,
    GeneralExtractionAttempts
  ),
  summarizeEvidence,
);

const emptyUrlFetchData: UrlFetchData = {
  responseUrl: '',
  fetchChain: [],
  requestUrl: '',
  status: '',
  timestamp: ''
};

const envTransform = sfp.mapEnv<UrlFetchData, ExtractionEnv>(
  (env) => initExtractionEnv(env, emptyUrlFetchData) ,
  (env, urlFetchData) => initExtractionEnv(env, urlFetchData)
);


const linkinghubSpideringRule: stflow.Transform<URL, HTTPResponse> = compose(
  spPrim.urlFilter(/linkinghub.elsevier.com/),
  spPrim.scrapeUrl(ScriptablePageInstanceOptions),
)

const defaultSpideringRule: stflow.Transform<URL, HTTPResponse> = compose(
  spPrim.scrapeUrl(),
)


const SpideringUrlSpecificAttempts: stflow.Transform<URL, HTTPResponse> = sfp.attemptEach(
  linkinghubSpideringRule,
  defaultSpideringRule
)

const SpideringPipeline: stflow.Transform<URL, UrlFetchData> = compose(
  SpideringUrlSpecificAttempts,
  // getHttpResponseBody,
  spPrim.httpResponseToUrlFetchData
);

export const SpiderAndExtractionTransform = compose(
  SpideringPipeline,
  envTransform,
  writeResponseBody,
  AbstractFieldAttempts
)
