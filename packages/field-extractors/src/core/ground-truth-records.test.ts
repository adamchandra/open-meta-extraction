import 'chai/register-should';

import _ from 'lodash';
import { prettyPrint, parseJsonStripMargin } from '@watr/commonlib';
import { ExtractionRecord } from './extraction-records';
import { initGroundTruthAssertions } from './ground-truth-records';


describe('Extraction Records and Ground Records', () => {
  const sampleExtractionRecord = (`
| {
|   "kind": "fields",
|   "fields": {
|     "abstract": {
|       "count": 0,
|       "instances": [
|         { "name": "abstract", "evidence": [],
|           "value": "Author Summary Whole-cell.."
|         },
|         { "name": "abstract", "evidence": [],
|           "value": "Whole-cell models ..."
|         }
|       ]
|     },
|     "title": {
|       "count": 0,
|       "instances": [
|         { "name": "title", "evidence": [],
|           "value": "Some Title"
|         }
|       ]
|     },
|     "pdf-link": {
|       "count": 0,
|       "instances": []
|     }
|   }
| }
`);

  it('should traverse extraction records', () => {
    const extractionRec: ExtractionRecord = parseJsonStripMargin(sampleExtractionRecord);

    const initGroundTruths = initGroundTruthAssertions(extractionRec);
    prettyPrint({ initGroundTruths });
  });
});
