import _ from 'lodash';

import {
  attemptEach,
  compose,
  Transform,
  tapLeft,
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


export const FieldExtractionAttempts: Transform<unknown, unknown> = compose(
  checkStatusAndNormalize,
  attemptEach(
    UrlSpecificAttempts,
    GeneralExtractionAttempts
  ),
  summarizeEvidence,
);

export const SpiderAndExtractionTransform = compose(
  SpideringPipeline,
  SpiderToExtractionEnv,
  FieldExtractionAttempts
)
