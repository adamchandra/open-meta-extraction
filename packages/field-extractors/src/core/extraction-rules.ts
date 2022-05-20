import _ from 'lodash';

import {
  attemptEach,
} from '~/predef/extraction-prelude';

import {
  summarizeEvidence,
  _addEvidence,
  compose,
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
