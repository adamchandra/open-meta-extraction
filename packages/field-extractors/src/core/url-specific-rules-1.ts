/**
 * URL-Specific rules for gathering metadata from html/xml
 *
 * Rules are broken out into separate files just for organization,
 * and to avoid overly long files
 **/

import _ from 'lodash';
import * as E from 'fp-ts/Either';

import {
  collectFanout,
  ExtractionRule,
  compose,
  through
} from '~/predef/extraction-prelude';

import {
  selectElemAttrEvidence,
  selectElemTextEvidence,
  selectEachElemTextEvidence,
  validateEvidence,
  urlFilter,
  selectAllElemAttrEvidence,
  selectXMLTag,
  selectXMLPath,
  forXMLInputs,
  withResponsePage,
  saveEvidence
} from '~/core/extraction-primitives';

import {
  gatherDublinCoreTags,
  gatherHighwirePressTags,
  gatherOpenGraphTags,
} from './headtag-scripts';

export const arxivOrgRule: ExtractionRule = compose(
  urlFilter(/export.arxiv.org/),
  forXMLInputs(/response-body/, compose(
    collectFanout(
      selectXMLTag(['feed', 'entry', '0', 'summary']),
      selectXMLTag(['feed', 'entry', '0', 'title']),
      compose(
        selectXMLPath(['feed', 'entry', '0', 'link']),
        through((linkArray: unknown) => {
          const links: any[] = linkArray as any;
          const pdfLinks = _.filter(links, l => l['$']['type'] === 'application/pdf');
          if (pdfLinks.length > 0) {
            const pdfLink = pdfLinks[0]['$']['href'];
            return E.right(pdfLink)
          }
          return E.left('pdf link not found')
        }),
        saveEvidence('xml:feed.entry[0].link[]'),
      ),
    ),
    validateEvidence({
      'feed.entry.0.summary': 'abstract',
      'feed.entry.0.title': 'title',
      'link': 'pdf-link',
    }),
  )),
);

export const scienceDirectRule: ExtractionRule = compose(
  urlFilter(/sciencedirect.com/),
  withResponsePage(compose(
    collectFanout(
      gatherHighwirePressTags,
      gatherOpenGraphTags,
      selectElemTextEvidence('.Abstracts'),
      selectElemTextEvidence('a.author'),
      selectElemAttrEvidence('div.PdfEmbed a.anchor', 'href'),
    ),
    validateEvidence({
      citation_title: 'title',
      'og:description': 'abstract-clipped', 
      '.Abstracts': 'abstract',
      'a.author': 'author',
      'div.PdfEmbed?': 'pdf-link',
    }),
  )),
);


export const dlAcmOrgRule: ExtractionRule = compose(
  urlFilter(/dl.acm.org/),
  withResponsePage(compose(
    collectFanout(
      gatherDublinCoreTags,
      selectElemTextEvidence('.citation__title'),
      selectElemTextEvidence('.abstractInFull'),
      selectAllElemAttrEvidence('a[class="author-name"]', 'title'),
      selectElemAttrEvidence('a[title="PDF"]', 'href'),
    ),
    validateEvidence({
      'DC.Title?': 'title',
      'citation__title?': 'title',
      abstractInFull: 'abstract',
      'DC.Creator?': 'author',
      'PDF?': 'pdf-link',
    }),
  )),
);

export const aclwebOrgRule: ExtractionRule = compose(
  urlFilter(/aclweb.org/),
  withResponsePage(compose(
    collectFanout(
      gatherHighwirePressTags,
      selectElemTextEvidence('.acl-abstract'),
    ),
    validateEvidence({
      citation_title: 'title',
      citation_author: 'author',
      citation_pdf_url: 'pdf-link',
      '.acl-abstract': 'abstract',
    }),
  )),
);

export const ijcaiOrgRule: ExtractionRule = compose(
  urlFilter(/ijcai.org/),
  withResponsePage(compose(
    collectFanout(
      gatherHighwirePressTags,
      selectElemTextEvidence('div.col-md-12'),
    ),
    validateEvidence({
      citation_title: 'title',
      citation_author: 'author',
      'div.col-md-12': 'abstract'
    }),
  )),
);

export const mitpressjournalsOrgRule: ExtractionRule = compose(
  urlFilter(/mitpressjournals.org/),
  withResponsePage(compose(
    collectFanout(
      gatherDublinCoreTags,
      selectElemAttrEvidence('a[class="show-pdf"]', 'href'),
      selectElemTextEvidence('.abstractInFull'),
    ),
    validateEvidence({
      'DC.Title': 'title',
      'DC.Creator': 'author',
      abstractInFull: 'abstract',
      'show-pdf': 'pdf-link',
    }),
  )),
);
export const academicOupComRule: ExtractionRule = compose(
  urlFilter(/academic.oup.com/),
  withResponsePage(compose(
    collectFanout(
      gatherHighwirePressTags,
      selectElemTextEvidence('section[class="abstract"] p[class="chapter-para"]'),
    ),
    validateEvidence({
      citation_title: 'title',
      citation_author: 'author',
      citation_pdf_url: 'pdf-link',
      abstract: 'abstract',
    }),
  )),
);


export const nipsCCRule: ExtractionRule = compose(
  urlFilter(/nips.cc/),
  withResponsePage(compose(
    collectFanout(
      gatherHighwirePressTags,
      selectElemTextEvidence('h4 + p'),
    ),
    validateEvidence({
      citation_title: 'title',
      citation_author: 'author',
      citation_pdf_url: 'pdf-link',
      'h4 + p': 'abstract'
    }),
  )),
);

export const iospressComRule: ExtractionRule = compose(
  urlFilter(/content.iospress.com/),
  withResponsePage(compose(
    collectFanout(
      gatherHighwirePressTags,
      selectElemAttrEvidence('[data-abstract]', 'data-abstract'),
    ),
    validateEvidence({
      citation_title: 'title',
      citation_author: 'author',
      citation_pdf_url: 'pdf-link',
      'data-abstract': 'abstract'
    }),
  )),
);

export const digitalHumanitiesOrg: ExtractionRule = compose(
  urlFilter(/digitalhumanities.org/),
  withResponsePage(compose(
    collectFanout(
      selectElemTextEvidence('#abstract'),
      selectElemTextEvidence('.articleTitle'),
      selectEachElemTextEvidence('.author'),
    ),
    validateEvidence({
      '#abstract': 'abstract',
      '.articleTitle': 'title',
      '.author': 'author',
    }),
  )),
);

export const kybernetikaCz: ExtractionRule = compose(
  urlFilter(/kybernetika.cz/),
  withResponsePage(compose(
    collectFanout(
      selectElemTextEvidence('.ar_title'),
      selectElemTextEvidence('.abstract'),
      selectEachElemTextEvidence('.authors a'),
    ),
    validateEvidence({
      '.abstract': 'abstract',
      '.ar_title': 'title',
      '.authors a': 'author',
    }),
  )),
);
