
import parseUrl from 'url-parse';

import {
  attemptEach,
  log,
  filter,
} from '~/predef/extraction-prelude';

import {
  clearEvidence,
  normalizeHtmls,
  statusFilter,
  summarizeEvidence,
  tryEvidenceMapping,
  _addEvidence,
  tapEnvLR,
  compose
} from '~/core/extraction-primitives';

import {
  gatherSchemaEvidence
} from './headtag-scripts';




const addUrlEvidence = tapEnvLR((env) => {
  const parsedUrl = parseUrl(env.urlFetchData.responseUrl);
  const { host } = parsedUrl;
  const paths = parsedUrl.pathname.split('/');
  const [, p1, p2] = paths.slice(0, -1);
  _addEvidence(env, `url:host:${host}`);
  if (p1 !== undefined) {
    _addEvidence(env, `url:path1:${p1}`);
  }
  if (p2 !== undefined) {
    _addEvidence(env, `url:path2:${p2}`);
  }
});


// Try some general rules that often work, not specific to any particular URL
export const GeneralExtractionAttempts = compose(
  addUrlEvidence,
  gatherSchemaEvidence,
  clearEvidence(/^url:/),
  attemptEach(
    tryEvidenceMapping({
      citation_title: 'title',
      citation_author: 'author',
      citation_pdf_url: 'pdf-link',
      'DC.Description|og:description': 'abstract',
    }),
    tryEvidenceMapping({
      'citation_title|DC.Title': 'title',
      'citation_author|DC.Creator': 'author',
      'citation_pdf_url?': 'pdf-link',
      '\\.abstractInFull|\\.abstract|#abstract': 'abstract:raw',
    }),
    tryEvidenceMapping({
      'og:title': 'title',
      'og:description': 'abstract',
    })
  )
);
