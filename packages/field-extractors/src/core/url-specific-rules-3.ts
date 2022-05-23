import {
    Transform,
    ExtractionRule,
    collectFanout,
    compose,
} from '~/predef/extraction-prelude';

import {
    forInputs,
    saveEvidence,
    validateEvidence,
    urlFilter
} from "./extraction-primitives";

import {
    dropN,
    grepDropUntil,
    grepFilterNot,
    grepTakeUntil,
    joinLines,
    loadTextFile,
    splitLines,
} from "./text-primitives";

import { gatherHighwirePressTags } from './headtag-scripts';


import {
    Elem,
    elemQueryOne,
    getElemAttr,
    getElemText,
    loadBrowserPage,
    selectOne
} from './html-query-primitives';



const selectNeuripsCCAbstract: Transform<string,
    unknown> = compose(
        splitLines,
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
        collectFanout(
            compose(loadBrowserPage, gatherHighwirePressTags),
            compose(loadTextFile, selectNeuripsCCAbstract)
        ),
        validateEvidence({
            citation_title: 'title',
            citation_author: 'author',
            citation_pdf_url: 'pdf-link',
            'neurips.cc.abstract': 'abstract'
        }),
    ))
);

const selectIscaSpeechAbstract: Transform<Elem, void> = compose(
    elemQueryOne('p'),
    getElemText,
    saveEvidence('isca.abstract'),
);


const selectIscaSpeechTitle: Transform<Elem, void> = compose(
    elemQueryOne('h3'),
    getElemText,
    saveEvidence('isca.title'),
);

const selectIscaSpeechAuthors: Transform<Elem, void> = compose(
    elemQueryOne('h5'),
    getElemText,
    saveEvidence('isca.authors'),
);


const selectIscaSpeechPDFLink: Transform<Elem, void> = compose(
    elemQueryOne('a'),
    getElemAttr('href'),
    saveEvidence('isca.pdf-partial-link'),
);

export const iscaSpeechOrgRule: ExtractionRule = compose(
    urlFilter(/isca-speech.org/),
    forInputs(/response-body/, compose(
        loadBrowserPage,
        selectOne('div.w3-card'),
        collectFanout(
            selectIscaSpeechAbstract,
            selectIscaSpeechAuthors,
            selectIscaSpeechPDFLink,
            selectIscaSpeechTitle,
        ),
        validateEvidence({
            title: 'title',
            authors: 'authors',
            'pdf-link?': 'pdf-link',
            'abstract': 'abstract',
        }),
    )),
);
