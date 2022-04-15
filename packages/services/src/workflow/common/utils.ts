import {  getCorpusEntryDirForUrl } from '@watr/commonlib';
import { getCanonicalFieldRecord, CanonicalFieldRecords } from '@watr/field-extractors';

export function getCanonicalFieldRecsForURL(url: string): CanonicalFieldRecords | undefined {
  const entryPath = getCorpusEntryDirForUrl(url);
  const fieldRecs = getCanonicalFieldRecord(entryPath);
  if (fieldRecs === undefined) {
    return;
  }
  return fieldRecs;
}
