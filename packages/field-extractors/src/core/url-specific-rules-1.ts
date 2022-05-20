/**
 * URL-Specific rules for gathering metadata from html/xml
 *
 * Rules are broken out into separate files just for organization,
 * and to avoid overly long files
 **/

import {
  gatherSuccess,
  ExtractionRule,
  compose,
} from '~/predef/extraction-prelude';

import {
  forInputs,
  selectElemAttrEvidence,
  selectElemTextEvidence,
  tryEvidenceMapping,
  urlFilter,
  selectAllElemAttrEvidence,
  selectXMLTag,
  forXMLInputs,
} from '~/core/extraction-primitives';

import {
  gatherDublinCoreTags,
  gatherHighwirePressTags,
  gatherOpenGraphTags,
} from './headtag-scripts';


export const arxivOrgRule: ExtractionRule = compose(
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
);

export const scienceDirectRule: ExtractionRule = compose(
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
);


export const dlAcmOrgRule: ExtractionRule = compose(
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
      'DC.Creator?': 'author',
      'PDF?': 'pdf-path',
    }),
  )),
);

export const aclwebOrgRule: ExtractionRule = compose(
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
      '.acl-abstract': 'abstract:raw', // TODO test this w/o leading .
    }),
  )),
);

export const ijcaiOrgRule: ExtractionRule = compose(
  urlFilter(/ijcai.org/),
  forInputs(/response-body/, compose(
    gatherSuccess(
      gatherHighwirePressTags,
      selectElemTextEvidence('div.col-md-12'),
    ),
    tryEvidenceMapping({
      citation_title: 'title',
      citation_author: 'author',
      'div.col-md-12': 'abstract'
    }),
  )),
);

export const mitpressjournalsOrgRule: ExtractionRule = compose(
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
);
export const academicOupComRule: ExtractionRule = compose(
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
);


export const nipsCCRule: ExtractionRule = compose(
  urlFilter(/nips.cc/),
  forInputs(/response-body/, compose(
    gatherSuccess(
      gatherHighwirePressTags,
      selectElemTextEvidence('h4 + p'),
    ),
    tryEvidenceMapping({
      citation_title: 'title',
      citation_author: 'author',
      citation_pdf_url: 'pdf-link',
      'h4 + p': 'abstract'
    }),
  )),
);


  // compose(
  //   urlFilter(/content.iospress.com/),
  //   forInputs(/response-body/, compose(
  //     gatherSuccess(
  //       gatherHighwirePressTags,
  //       selectElemAttrEvidence('a[title="PDF"]', 'href'),
  //     ),
  //     tryEvidenceMapping({
  //       citation_title: 'title',
  //       citation_author: 'author',
  //       'div.col-md-12': 'abstract'
  //     }),
  //   )),
  // )
