import _ from 'lodash';

import {
  eachOrElse,
  compose,
  Transform,
} from '~/predef/extraction-prelude';


import {
  summarizeEvidence,
  checkStatusAndNormalize,
} from '~/core/extraction-primitives';

import { UrlSpecificAttempts } from './url-specific-rules';
import { GeneralExtractionAttempts } from './non-specific-rules';

import {
  SpideringPipeline,
  SpiderToExtractionEnv
} from './spidering-rules';


// Field extraction pipeline
export const FieldExtractionAttempts: Transform<unknown, unknown> = compose(
  checkStatusAndNormalize,
  eachOrElse(
    UrlSpecificAttempts,
    GeneralExtractionAttempts
  ),
  summarizeEvidence,
);

// Full spidering + extraction pipeline
export const SpiderAndExtractionTransform = compose(
  SpideringPipeline,
  SpiderToExtractionEnv,
  FieldExtractionAttempts
);
