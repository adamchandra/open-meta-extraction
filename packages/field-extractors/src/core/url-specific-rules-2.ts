/**
 * URL-Specific rules for gathering metadata from html/xml
 *
 * Rules are broken out into separate files just for organization,
 * and to avoid overly long files
 **/

import _ from 'lodash';

import { GlobalDocumentMetadata } from '~/predef/ieee-metadata';

import {
  attemptEach,
  ExtractionRule,
  Transform,
  forEachDo,
  through,
  ClientFunc,
  gatherSuccess,
  CacheFileKey,
  compose,
} from '~/predef/extraction-prelude';

import {
  forInputs,
  selectElemTextEvidence,
  tryEvidenceMapping,
  urlFilter,
  saveEvidence,
  grepFilter
} from '~/core/extraction-primitives';

import {
  gatherHighwirePressTags,
  gatherOpenGraphTags,
} from './headtag-scripts';

import {
  getElemText,
  selectOne
} from './html-query-primitives';


const readSpringerDocumentMetadata: Transform<CacheFileKey, any> = compose(
  selectOne('script[type="application/ld+json"]'),
  getElemText,
  through((jsonText, env) => {
    if (!_.isString(jsonText) || jsonText.length === 0) {
      return ClientFunc.continue('springer-link.metadata not found');
    }
    const i1 = jsonText.indexOf('{');
    const i2 = jsonText.lastIndexOf('}')
    if (i1 < 0 || i2 < 0) {
      return ClientFunc.continue('springer-link.metadata doesnt look like json');
    }
    const strippedJson = jsonText.slice(i1, i2 + 1);
    try {
      return JSON.parse(strippedJson);
    } catch (error) {
      env.log.warn(`readSpringerDocumentMetadata: Could not parse JSON text`);
      return ClientFunc.continue('springer-link.metadata not parsable');
    }
  }, 'readSpringerMetadata'));

const saveMetaDataEvidence: (name: string, f: (m: any) => string[]) => Transform<any, unknown> = (name, f) => compose(
  through((documentMetadata) => f(documentMetadata), `saveAnyMetaEvidence(${name})`),
  forEachDo(
    saveEvidence(name),
  ),
);

const selectSpringerDocumentMetaEvidence: () => Transform<CacheFileKey, unknown> = () => compose(
  readSpringerDocumentMetadata,
  gatherSuccess(
    saveMetaDataEvidence('metadata:title', m => m.headline ? [m.headline] : []),
    saveMetaDataEvidence('metadata:abstract', m => m.description ? [m.description] : []),
    saveMetaDataEvidence('metadata:author', m => m.author && _.isArray(m.author) ? m.author.map((a: any) => a.name) : []),
  )
);

export const linkSpringerComRule: ExtractionRule = compose(
  urlFilter(/link.springer.com/),
  forInputs(/response-body/, compose(
    gatherSuccess(
      gatherHighwirePressTags,
      gatherOpenGraphTags,
      selectElemTextEvidence('section#Abs1 > p.Para'),
      compose(
        selectSpringerDocumentMetaEvidence(),
        tryEvidenceMapping({
          'metadata:title': 'title',
          'metadata:abstract': 'abstract',
          'metadata:author?': 'author',
        }),
      ),
    ),
    attemptEach(
      compose(
        urlFilter(/\/chapter\//),
        tryEvidenceMapping({ // link.springer.com/chapter
          citation_title: 'title',
          citation_author: 'author',
          citation_pdf_url: 'pdf-link',
          'og:description': 'abstract-clipped',
          'section#Abs1 > p.Para': 'abstract',
        }),
      ),
      compose(
        urlFilter(/\/article\//),
        tryEvidenceMapping({ // link.springer.com/article
          citation_title: 'title',
          citation_author: 'author',
          citation_pdf_url: 'pdf-link',
          'og:description': 'abstract',
        }),
      ),
    )
  )),
);

const readGlobalDocumentMetadata: Transform<CacheFileKey, GlobalDocumentMetadata> = compose(
  grepFilter(/global\.document\.metadata/i),
  through((lines) => {
    if (lines.length === 0) {
      return ClientFunc.continue('global.document.metadata not found');
    }
    const line = lines[0];
    const jsonStart = line.indexOf('{');
    const jsonEnd = line.lastIndexOf('}');
    const lineJson = line.slice(jsonStart, jsonEnd + 1);
    const globalMetadata: GlobalDocumentMetadata = JSON.parse(lineJson);
    return globalMetadata;
  }, 'readGlobalMetadata'));


const saveDocumentMetaDataEvidence: (name: string, f: (m: GlobalDocumentMetadata) => string[]) => Transform<GlobalDocumentMetadata, unknown> = (name, f) => compose(
  through((documentMetadata) => f(documentMetadata), `saveMetaEvidence(${name})`),
  forEachDo(
    saveEvidence(name),
  ),
);

const selectGlobalDocumentMetaEvidence: () => Transform<CacheFileKey, unknown> = () => compose(
  readGlobalDocumentMetadata,
  gatherSuccess(
    saveDocumentMetaDataEvidence('metadata:title', m => m.title ? [m.title] : []),
    saveDocumentMetaDataEvidence('metadata:abstract', m => m.abstract ? [m.abstract] : []),
    saveDocumentMetaDataEvidence('metadata:pdf-path', m => m.pdfPath ? [m.pdfPath] : []),
    saveDocumentMetaDataEvidence('metadata:author', m => m.authors && _.isArray(m.authors) ? m.authors.map(a => a.name) : []),
  )
);


export const ieeExploreOrgRule: ExtractionRule = compose(
  urlFilter(/ieeexplore.ieee.org/),
  forInputs(/response-body/, compose(
    selectGlobalDocumentMetaEvidence(),
    tryEvidenceMapping({
      'metadata:title': 'title',
      'metadata:abstract': 'abstract',
      'metadata:author?': 'author',
      'metadata:pdf-path?': 'pdf-path',
    }),
  )),
);
