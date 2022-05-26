import _ from 'lodash';

import {
  attemptEach,
  compose,
  ExtractionRule,
  Transform,
  mapEnv,
  SpiderToExtractionEnvTransform,
  ExtractionEnv,
} from '~/predef/extraction-prelude';

import {
  summarizeEvidence,
  checkStatusAndNormalize,
  urlFilter,
  initExtractionEnv
} from '~/core/extraction-primitives';

import { UrlSpecificAttempts } from './url-specific-rules';
import { GeneralExtractionAttempts } from './non-specific-rules';


import {
  createSpiderEnv,
  getHttpResponseBody,
  httpResponseToUrlFetchData,
  scrapeUrl,
  ScriptablePageInstanceOptions,
  writeResponseBody,
  spiderTaskflow as sfp,
  SpiderEnv,
  UrlFetchData
} from '@watr/spider';


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


const linkinghubSpideringRule: ExtractionRule = compose(
  urlFilter(/linkinghub.elsevier.com/),
  scrapeUrl(ScriptablePageInstanceOptions),
)

const defaultSpideringRule: ExtractionRule = compose(
  scrapeUrl(),
)

const SpideringUrlSpecificAttempts = attemptEach(
  linkinghubSpideringRule,
  defaultSpideringRule
)

const SpideringPipeline = compose(
  SpideringUrlSpecificAttempts,
  writeResponseBody,
  // getHttpResponseBody,
  // httpResponseToUrlFetchData
);

const SpiderAndExtractionTransform = compose(
  SpideringPipeline,
  envTransform,
  AbstractFieldAttempts
)
