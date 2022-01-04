import { QualifiedKey, Primitive, QualifiedKeyValue, toQualifiedKeyValues } from '@watr/commonlib';
import _ from 'lodash';
import { ExtractionRecord } from './extraction-records';


export type GroundTruthAssertion =
  'IsObservedValue'
  | 'IsCorrectValue'
  | 'IsIncorrectValue'
  ;

export interface GroundTruthLabel {
  key: QualifiedKey;
  value: Primitive;
  assertion: GroundTruthAssertion;
}

export interface GroundTruthLabels {
  labels: GroundTruthLabel[];
}

export function initGroundTruthAssertions(extractionRecord: ExtractionRecord): GroundTruthLabels {
  const pathValues: QualifiedKeyValue[] = toQualifiedKeyValues(extractionRecord);
  // retain entries that have leaf-paths named 'exists|count|value'
  const wanted = new Set(['exists', 'count', 'value']);
  const retained: QualifiedKeyValue[] = _.flatMap(
    pathValues, pv => {
      const leafPathPart = _.last(pv[0]);
      if (leafPathPart && wanted.has(leafPathPart)) {
        return [pv];
      }
      return [];
    });

  const labels = _.map(retained, ([key, value]) => {
    const l: GroundTruthLabel = {
      key: [key],
      value,
      assertion: 'IsObservedValue',
    };
    return l;
  });

  // prettyPrint({ labels });

  return {
    labels
  };
}
