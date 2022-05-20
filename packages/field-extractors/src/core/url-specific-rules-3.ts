import {
    Transform,
    ExtractionRule,
    gatherSuccess,
    CacheFileKey,
    compose,
} from '~/predef/extraction-prelude';

import {
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
import { BrowserPage, Elem, elemQueryOne, getElemAttr, getElemText, loadPageFromCache, pageQueryOne, selectOne } from './html-query-primitives';

const selectNeuripsCCAbstract: Transform<CacheFileKey, unknown> = compose(
    grepDropUntil(/Abstract/),
    dropN(1),
    grepTakeUntil(/^[ ]+<.div/),
    grepFilterNot(/^[ ]+<.{1,4}>[ ]*$/),
    joinLines(' '),
    saveEvidence('neurips.cc.abstract'),
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

const selectIscaSpeechAbstract: Transform<Elem, unknown> = compose(
    elemQueryOne('p'),
    getElemText,
    saveEvidence('isca.abstract'),
);


const selectIscaSpeechTitle: Transform<Elem, unknown> = compose(
    elemQueryOne('h3'),
    getElemText,
    saveEvidence('isca.title'),
);

const selectIscaSpeechAuthors: Transform<Elem, unknown> = compose(
    elemQueryOne('h5'),
    getElemText,
    saveEvidence('isca.authors'),
);


const selectIscaSpeechPDFLink: Transform<Elem, unknown> = compose(
    elemQueryOne('a'),
    getElemAttr('href'),
    saveEvidence('isca.pdf-partial-link'),
);

export const iscaSpeechOrgRule: ExtractionRule = compose(
    urlFilter(/isca-speech.org/),
    forInputs(/response-body/, compose(
        loadPageFromCache,
        pageQueryOne('div.w3-card'),
        gatherSuccess(
            selectIscaSpeechAbstract,
            selectIscaSpeechAuthors,
            selectIscaSpeechPDFLink,
            selectIscaSpeechTitle,
        ),
        tryEvidenceMapping({
            title: 'title',
            authors: 'authors',
            'pdf-link?': 'pdf-link',
            'abstract': 'abstract',
        }),
    )),
);
