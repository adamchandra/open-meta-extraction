/**
 * Logs and Records generated during field extraction and Url scraping
 */

import _ from 'lodash';

export interface Field {
  name: string;
  evidence: string[];
  value?: string; // TODO this should be non-optional
}

export interface FieldInstances {
  exists: boolean;
  count: number;
  instances: Field[];
}

export interface ExtractedField {
  kind: 'field';
  field: Field;
}

export interface ExtractedFields {
  kind: 'fields';
  fields: Record<string, FieldInstances>;
}

// export interface ExtractedStanzas {
//   kind: 'stanzas';
//   stanzas: string[];
// }

// export interface ExtractedGroups {
//   kind: 'groups';
//   groups: ExtractedFields[];
// }
export interface ExtractionErrors {
  kind: 'errors';
  errors: string[];
}

export interface ExtractionEvidence {
  kind: 'evidence';
  evidence: string;
  weight: number;
}

export type ExtractionRecord =
  ExtractedFields
  | ExtractedField
  | ExtractionEvidence
  // | ExtractedStanzas
  // | ExtractedGroups
  | ExtractionErrors
  ;


export interface ExtractionRecordFoldCases<A> {
  onFields: (v: ExtractedFields) => A;
  onField: (v: ExtractedField) => A;
  onEvidence: (v: ExtractionEvidence) => A,
  // onStanzas: (v: ExtractedStanzas) => A;
  // onGroups: (v: ExtractedGroups) => A;
  onErrors: (v: ExtractionErrors) => A;
}

const emptyFoldCases: ExtractionRecordFoldCases<undefined> = {
  onFields: (_v: ExtractedFields) => undefined,
  onField: (_v: ExtractedField) => undefined,
  onEvidence: (_v: ExtractionEvidence) => undefined,
  // onStanzas: (v: ExtractedStanzas) => undefined;
  // onGroups: (v: ExtractedGroups) => undefined;
  onErrors: (_v: ExtractionErrors) => undefined,
};

export function foldExtractionRec<A>(
  rec: ExtractionRecord,
  cases: Partial<ExtractionRecordFoldCases<A>>
): A | undefined {
  const cs = _.merge({}, emptyFoldCases, cases);
  switch (rec.kind) {
    case 'fields': return cs.onFields(rec);
    case 'field': return cs.onField(rec);
    case 'evidence': return cs.onEvidence(rec);
    // case 'stanzas': return cs.onStanzas(rec);
    // case 'groups': return cs.onGroups(rec);
    case 'errors': return cs.onErrors(rec);
  }
}

export function addFieldInstance(rec: ExtractionRecord, field: Field): void {
  return foldExtractionRec(rec, {
    onFields: (rec) => {
      const instances: FieldInstances = rec.fields[field.name] || { exists: true, count: 0, instances: [] };

      instances.instances.push(field);
      instances.count += 1;
      rec.fields[field.name] = instances;
    }
  });
}

