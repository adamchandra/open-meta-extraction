/// <reference lib="dom" />

import _ from 'lodash';
import * as E from 'fp-ts/Either';
import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';

import {
  Page,
  ElementHandle,
} from 'puppeteer';

import { DefaultPageInstanceOptions } from '@watr/spider';

import {
  Transform,
  through,
  ClientFunc,
} from '~/predef/extraction-prelude';

import { CacheFileKey, compose } from './extraction-primitives';

export type AttrSelection = E.Either<string, string>;

export type Elem = ElementHandle<Element>;
export type ElemSelectOne = E.Either<string, Elem>;
export type ElemSelectAll = E.Either<string, Elem[]>;

export function expandCaseVariations(seed: string, sub: (s: string) => string): string {
  const variations = _.reduce(seed, (acc, char) => {
    const isUpper = char >= 'A' && char <= 'Z';
    return _.flatMap(acc, (elem) => {
      if (isUpper) return [elem + char, elem + char.toLowerCase()];
      return [elem + char.toLowerCase()];
    });
  }, ['']);


  const expanded = _.join(
    _.map(variations, v => sub(v)),
    ','
  );

  return expanded;
}

function formatCSSSelectionError(error: unknown, cssSelector: string): string {
  if (error instanceof Error) {
    const msg = error.message;

    if (/failed.to.find.element.matching.selector/.test(msg)) {
      return `no match for ${cssSelector}`;
    }
    return `${error.message}`;
  }
  return `?${error}`;
}

export async function queryAllP(
  page: Page,
  query: string
): Promise<ElemSelectAll> {
  try {
    const elems: ElementHandle<Element>[] = await page.$$(query);
    return E.right(elems);
  } catch (error) {
    const msg = formatCSSSelectionError(error, query);
    return E.left(msg);
  }
}

export async function queryOneP(
  page: Page,
  query: string
): Promise<ElemSelectOne> {
  return queryAllP(page, query)
    .then(elems => {
      return pipe(elems, E.chain(es => {
        return es.length > 0
          ? E.right(es[0])
          : E.left(`empty selection '${query}'`);
      }));
    });
}

export async function selectElementAttrP(
  page: Page,
  elementSelector: string,
  attributeName: string,
  selectorDesc?: string
): Promise<AttrSelection> {
  const displayDesc = selectorDesc? selectorDesc : elementSelector;
  try {
    const maybeAttr = await page.$eval(elementSelector, (elem: Element, attr: unknown) => {
      if (typeof attr !== 'string') {
        throw new TypeError(`attr ${attr} did not eval to string`);
      }
      const attrValue = elem.getAttribute(attr);
      const elemHtml = elem.outerHTML;
      return { elemHtml, attrValue };
    }, attributeName);

    if (maybeAttr === null) return E.left(`empty selection '${displayDesc}'`);

    const { attrValue } = maybeAttr;
    if (attrValue === null) return E.left(`no attr ${attributeName} in select('${displayDesc}')`);

    return E.right(attrValue);
  } catch (error) {
    const msg = formatCSSSelectionError(error, displayDesc);
    return E.left(msg);
  }
}

const loadPageFromCache: Transform<CacheFileKey, Page> =
  through((cacheKey: CacheFileKey, { browserInstance, fileContentCache, browserPageCache }) => {
    if (cacheKey in browserPageCache) {
      return browserPageCache[cacheKey];
    }
    if (cacheKey in fileContentCache) {
      const fileContent = fileContentCache[cacheKey];
      const page = browserInstance.newPage(DefaultPageInstanceOptions) // TODO: FIXME this use of defaults is not correct
        .then(async ({ page }) => {
          await page.setContent(fileContent, {
            timeout: 8000,
            waitUntil: 'domcontentloaded',
            // waitUntil: 'load',
          });
          browserPageCache[cacheKey] = page;
          return page;
        });
      return page;
    }

    return ClientFunc.halt(`cache has no record for key ${cacheKey}`);
  });

export const selectOne: (queryString: string) => Transform<CacheFileKey, Elem> = (queryString) => compose(
  loadPageFromCache,
  through((page: Page, { }) => {
    return pipe(
      () => queryOneP(page, queryString),
      TE.mapLeft((msg) => ['continue', msg])
    );
  }, `selectOne(${queryString})`)
);

export const selectAll: (queryString: string, abbrev?: string) => Transform<CacheFileKey, Elem[]> = (queryString, abbrev) => compose(
  loadPageFromCache,
  through((page: Page, { }) => {
    return pipe(
      () => queryAllP(page, queryString),
      TE.mapLeft((msg) => ['continue', msg])
    );
  }, `selectAll(${abbrev ? abbrev : queryString})`)
);

export const getElemAttr: (attr: string) => Transform<Elem, string> = (attr: string) => through((elem: Elem, { }) => {
  const attrContent: Promise<E.Either<string, string>> = elem.evaluate((e, attrname) => e.getAttribute(attrname), attr)
    .then(text => (text === null
      ? E.left(`getElemAttr: no attr content found in elem attr ${attr}`)
      : E.right(text)))
    .catch((error) => {
      return E.left(`getElemAttr error ${error}`);
    });

  return pipe(
    () => attrContent,
    TE.mapLeft((msg) => ['continue', msg]),
  );
}, 'getElemAttr');


export const getElemText: Transform<Elem, string> = through((elem: Elem) => {
  const textContent: Promise<E.Either<string, string>> = elem.evaluate(e => e.textContent)
    .then(text => (text === null
      ? E.left('no text found in elem')
      : E.right(text.trim())));

  return pipe(
    () => textContent,
    TE.mapLeft((msg) => ['continue', msg]),
  );
}, 'getElemText');


export const selectElemAttr: (queryString: string, contentAttr: string, queryDesc?: string) => Transform<CacheFileKey, string> =
  (queryString, contentAttr, queryDesc) => compose(
    loadPageFromCache,
    through((page: Page, { }) => {
      return pipe(
        () => selectElementAttrP(page, queryString, contentAttr, queryDesc),
        TE.mapLeft((msg) => ['continue', msg])
      );
    }, `selectElemAttr(${queryDesc ? queryDesc : queryString}, ${contentAttr})`)
  );
