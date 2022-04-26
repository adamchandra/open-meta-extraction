import _ from 'lodash';

import { flow as fptsFlow, pipe } from 'fp-ts/function';

import parseUrl from 'url-parse';

import {
  gatherSuccess,
  attemptEach,
  log,
  filter,
} from '~/predef/extraction-prelude';

import {
  clearEvidence,
  forInputs,
  normalizeHtmls,
  selectAllMetaEvidence,
  selectElemAttrEvidence,
  selectElemTextEvidence,
  selectGlobalDocumentMetaEvidence,
  selectMetaEvidence,
  statusFilter,
  summarizeEvidence,
  tryEvidenceMapping,
  urlFilter,
  _addEvidence,
  tapEnvLR,
  selectAllElemAttrEvidence,
  selectXMLTag,
  forXMLInputs
} from '~/core/extraction-primitives';
import { selectSpringerDocumentMetaEvidence } from '..';

const compose: typeof fptsFlow = (...fs: []) =>
  <A extends readonly unknown[]>(a: A) =>
    pipe(a, ...fs);

const checkStatusAndNormalize = compose(
  log('info', (_0, env) => `Processing ${env.urlFetchData.responseUrl}`),
  statusFilter,
  normalizeHtmls,
  filter((a) => a.length > 0),
);

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

const gatherHighwirePressTags = gatherSuccess(
  selectMetaEvidence('citation_title'),
  selectMetaEvidence('citation_date'),
  selectMetaEvidence('citation_pdf_url'),
  selectMetaEvidence('citation_abstract'),
  selectAllMetaEvidence('citation_author'),
);

const gatherOpenGraphTags = gatherSuccess(
  selectMetaEvidence('og:url'),
  selectMetaEvidence('og:url', 'property'),
  selectMetaEvidence('og:title'),
  selectMetaEvidence('og:title', 'property'),
  selectMetaEvidence('og:type'),
  selectMetaEvidence('og:type', 'property'),
  selectMetaEvidence('og:description'),
  selectMetaEvidence('og:description', 'property'),
);

const gatherDublinCoreTags = gatherSuccess(
  selectMetaEvidence('DC.Description'),
  selectMetaEvidence('DC.Title'),
  selectAllMetaEvidence('DC.Creator'),
  selectAllMetaEvidence('DC.Subject'),
  selectAllMetaEvidence('DC.Identifier'),
  selectAllMetaEvidence('DC.Type'),
);

const gatherSchemaEvidence = forInputs(
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

const UrlSpecificAttempts = attemptEach(
  compose(
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
  ),
  compose(
    urlFilter(/export.arxiv.org/),
    forXMLInputs(/response-body/, compose(
      gatherSuccess(
        selectXMLTag(['feed', 'entry', '0', 'summary']),
        selectXMLTag(['feed', 'entry', '0', 'title']),
      ),
      tryEvidenceMapping({
        'feed.entry.0.summary': 'abstract',
        'feed.entry.0.title': 'title',
      }),
    )),
  ),
  compose(
    urlFilter(/sciencedirect.com/),
    forInputs(/response-body/, compose(
      gatherSuccess(
        gatherHighwirePressTags,
        gatherOpenGraphTags,
        selectElemTextEvidence('.Abstracts'),
        selectElemTextEvidence('a.author'), // TODO selectAll??
        selectElemAttrEvidence('div.PdfEmbed a.anchor', 'href'),
      ),
      tryEvidenceMapping({
        citation_title: 'title',
        'og:description': 'abstract-clipped',
        '.Abstracts': 'abstract:raw',
        'a.author': 'author',
        'div.PdfEmbed?': 'pdf-path',
      }),
    )),
  ),
  compose(
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
  ),

  compose(
    urlFilter(/dl.acm.org/),
    forInputs(/response-body/, compose(
      gatherSuccess(
        gatherDublinCoreTags,
        selectElemTextEvidence('.citation__title'),
        selectElemTextEvidence('.abstractInFull'),
        selectAllElemAttrEvidence('a[class="author-name"]', 'title'),
        selectElemAttrEvidence('a[title="PDF"]', 'href'),
      ),
      tryEvidenceMapping({
        'DC.Title?': 'title',
        'citation__title?': 'title',
        abstractInFull: 'abstract',
        'author-name': 'author',
        PDF: 'pdf-path',
      }),
    )),
  ),

  compose(
    urlFilter(/aclweb.org/),
    forInputs(/response-body/, compose(
      gatherSuccess(
        gatherHighwirePressTags,
        selectElemTextEvidence('.acl-abstract'),
      ),
      tryEvidenceMapping({
        citation_title: 'title',
        citation_author: 'author',
        citation_pdf_url: 'pdf-link',
        'acl-abstract': 'abstract:raw',
      }),
    )),
  ),

  compose(
    urlFilter(/mitpressjournals.org/),
    forInputs(/response-body/, compose(
      gatherSuccess(
        gatherDublinCoreTags,
        selectElemAttrEvidence('a[class="show-pdf"]', 'href'),
        selectElemTextEvidence('.abstractInFull'),
      ),
      tryEvidenceMapping({
        'DC.Title': 'title',
        'DC.Creator': 'author',
        abstractInFull: 'abstract:raw',
        'show-pdf': 'pdf-link',
      }),
    )),
  ),
  compose(
    urlFilter(/academic.oup.com/),
    forInputs(/response-body/, compose(
      gatherSuccess(
        gatherHighwirePressTags,
        selectElemTextEvidence('section[class="abstract"] p[class="chapter-para"]'),
      ),
      tryEvidenceMapping({
        citation_title: 'title',
        citation_author: 'author',
        citation_pdf_url: 'pdf-link',
        abstract: 'abstract:raw',
      }),
    )),
  ),
  compose(
    urlFilter(/n(eur)?ips.cc/),
    forInputs(/response-body/, compose(
      gatherSuccess(
        gatherHighwirePressTags,
        selectElemTextEvidence('h4 + p'),
      ),
      tryEvidenceMapping({
        citation_title: 'title',
        citation_author: 'author',
        citation_pdf_url: 'pdf-link',
        abstract: 'h4 + p'
      }),
    )),
  ),
);

// Try some general rules that often work, not specific to any particular URL
const GeneralAttempt = compose(
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

export const AbstractFieldAttempts = compose(
  checkStatusAndNormalize,
  attemptEach(
    UrlSpecificAttempts,
    GeneralAttempt
  ),
  summarizeEvidence,
);
