import {
    Transform,
    ExtractionRule,
    gatherSuccess,
} from '~/predef/extraction-prelude';

import {
    addEvidence,
    CacheFileKey,
    clearEvidence,
    compose,
    dropN,
    forInputs,
    grepDropUntil,
    grepFilterNot,
    grepTakeUntil,
    joinLines,
    saveEvidence,
    selectElemTextEvidence,
    tryEvidenceMapping,
    urlFilter
} from "./extraction-primitives";

import { gatherHighwirePressTags } from './headtag-scripts';

const selectNeuripsCCAbstract: Transform<CacheFileKey, unknown> = compose(
    grepDropUntil(/Abstract/),
    dropN(1),
    grepTakeUntil(/^[ ]+<.div/),
    grepFilterNot(/^[ ]+<.{1,4}>[ ]*$/),
    joinLines(' '),
    addEvidence(() => 'neurips.cc.abstract'),
    saveEvidence('neurips.cc.abstract'),
    clearEvidence(new RegExp('neurips.cc.abstract')),
);

export const neuripsCCRule: ExtractionRule = compose(
    urlFilter(/neurips.cc/),
    forInputs(/response-body/, compose(
        gatherSuccess(
            gatherHighwirePressTags,
            selectNeuripsCCAbstract
        ),
        tryEvidenceMapping({
            citation_title: 'title',
            citation_author: 'author',
            citation_pdf_url: 'pdf-link',
            'neurips.cc.abstract': 'abstract'
        }),
    ))
);


const selectIscaSpeechAbstract: Transform<CacheFileKey, unknown> = compose(
    grepDropUntil(/Abstract/),
    dropN(1),
    grepTakeUntil(/^[ ]+<.div/),
    grepFilterNot(/^[ ]+<.{1,4}>[ ]*$/),
    joinLines(' '),
    addEvidence(() => 'neurips.cc.abstract'),
    saveEvidence('neurips.cc.abstract'),
    clearEvidence(new RegExp('neurips.cc.abstract')),
);

// https://www.isca-speech.org/archive/sltu_2012/nakagawa12_sltu.html
export const iscaSpeechOrgRule: ExtractionRule = compose(
  urlFilter(/isca-speech.org/),
  forInputs(/response-body/, compose(
    gatherSuccess(
      selectIscaSpeechAbstract,
    ),
    tryEvidenceMapping({
      // citation_title: 'title',
      // citation_author: 'author',
      // citation_pdf_url: 'pdf-link',
      'abstract': 'abstract'
    }),
  )),
);
