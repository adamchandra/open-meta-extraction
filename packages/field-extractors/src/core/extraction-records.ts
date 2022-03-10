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

export interface ExtractionErrors {
  kind: 'errors';
  url?: string;
  finalUrl?: string;
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
  | ExtractionErrors
  ;

export interface FieldRecord {
  name: string;
  value: string;
}

export interface CanonicalFieldRecords {
  noteId?: string;
  url?: string;
  finalUrl?: string;
  title?: string;
  fields: FieldRecord[];
}

export const ExtractionErrors = (error: string, args: Partial<ExtractionErrors>): ExtractionErrors => ({
  kind: 'errors',
  ...args,
  errors: [error]
});
