import {
  gatherSuccess,
} from '~/predef/extraction-prelude';

import {
  forInputs,
  selectAllMetaEvidence,
  selectElemTextEvidence,
  selectMetaEvidence,
  _addEvidence,
} from '~/core/extraction-primitives';

/**
 * Scripts for gathering metadata from html <head> section
 * */

export const gatherHighwirePressTags = gatherSuccess(
  selectMetaEvidence('citation_title'),
  selectMetaEvidence('citation_date'),
  selectMetaEvidence('citation_pdf_url'),
  selectMetaEvidence('citation_abstract'),
  selectAllMetaEvidence('citation_author'),
);

export const gatherOpenGraphTags = gatherSuccess(
  selectMetaEvidence('og:url'),
  selectMetaEvidence('og:url', 'property'),
  selectMetaEvidence('og:title'),
  selectMetaEvidence('og:title', 'property'),
  selectMetaEvidence('og:type'),
  selectMetaEvidence('og:type', 'property'),
  selectMetaEvidence('og:description'),
  selectMetaEvidence('og:description', 'property'),
);

export const gatherDublinCoreTags = gatherSuccess(
  selectMetaEvidence('DC.Description'),
  selectMetaEvidence('DC.Title'),
  selectAllMetaEvidence('DC.Creator'),
  selectAllMetaEvidence('DC.Subject'),
  selectAllMetaEvidence('DC.Identifier'),
  selectAllMetaEvidence('DC.Type'),
);

export const gatherSchemaEvidence = forInputs(
  /response-body/,
  gatherSuccess(
    gatherHighwirePressTags,
    gatherOpenGraphTags,
    gatherDublinCoreTags,

    selectMetaEvidence('description'),
    selectElemTextEvidence('.abstract'),
    selectElemTextEvidence('#abstract'),
    selectElemTextEvidence('#Abstracts'),
    selectElemTextEvidence('.abstractInFull'),
  ),
);
