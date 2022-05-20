import _ from 'lodash';

import {
  attemptEach,
  compose,
} from '~/predef/extraction-prelude';

import {
  summarizeEvidence,
  checkStatusAndNormalize
} from '~/core/extraction-primitives';

import { UrlSpecificAttempts } from './url-specific-rules';
import { GeneralExtractionAttempts } from './non-specific-rules';


export const AbstractFieldAttempts = compose(
  checkStatusAndNormalize,
  attemptEach(
    UrlSpecificAttempts,
    GeneralExtractionAttempts
  ),
  summarizeEvidence,
);
