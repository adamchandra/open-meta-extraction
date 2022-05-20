import parseUrl from 'url-parse';

import {
  compose,
  attemptEach,
} from '~/predef/extraction-prelude';

import {
  addEvidences,
  clearEvidence,
  tryEvidenceMapping,
} from '~/core/extraction-primitives';

import {
  gatherSchemaEvidence
} from './headtag-scripts';

const addUrlEvidence = addEvidences((a, env) => {
  const parsedUrl = parseUrl(env.urlFetchData.responseUrl);
  const { host } = parsedUrl;
  const paths = parsedUrl.pathname.split('/');
  const [, p1, p2] = paths.slice(0, -1);
  return [
    `url:host:${host}`,
    `url:path1:${p1}`,
    `url:path2:${p2}`,
  ];
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
