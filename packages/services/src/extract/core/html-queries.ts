import _ from 'lodash';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import {
  Page,
  Browser,
  ElementHandle,
  // errors as puppeteerErrors
} from 'puppeteer';

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

export async function queryAllP(
  page: Page,
  query: string
): Promise<ElemSelectAll> {
  try {
    const elems: ElementHandle<Element>[] = await page.$$(query);
    return E.right(elems);
  } catch (error) {
    if (error instanceof Error) {
      return E.left(`${error.name}: ${error.message}`);
    }
    return E.left(`${error}`);
  }
}

export async function queryAll(
  browser: Browser,
  sourceHtml: string,
  query: string
): Promise<ElemSelectAll> {
  const page: Page = await browser.newPage();

  try {
    await page.setContent(sourceHtml, {
      timeout: 4000,
      waitUntil: 'domcontentloaded',
    });

    return await queryAllP(page, query);
  } catch (error) {
    if (error instanceof Error) {
      return E.left(`${error.name}: ${error.message}`);
    }
    return E.left(`${error}`);
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
export async function queryOne(
  browser: Browser,
  sourceHtml: string,
  query: string
): Promise<ElemSelectOne> {
  return queryAll(browser, sourceHtml, query)
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
  attributeName: string
): Promise<AttrSelection> {
  try {
    const maybeAttr = await page.$eval(elementSelector, (elem: Element, attr: unknown) => {
      if (typeof attr !== 'string') {
        throw new TypeError(`attr ${attr} did not eval to string`);
      }
      const attrValue = elem.getAttribute(attr);
      const elemHtml = elem.outerHTML;
      return { elemHtml, attrValue };
    }, attributeName);

    if (maybeAttr === null) return E.left(`empty selection '${elementSelector}'`);

    const { attrValue } = maybeAttr;
    if (attrValue === null) return E.left(`no attr ${attributeName} in select('${elementSelector}')`);

    return E.right(attrValue);
  } catch (error) {
    // if (error instanceof puppeteerErrors.TimeoutError) {
    //   // TODO Do something if this is a timeout.
    // }
    if (error instanceof Error) {
      return E.left(`${error.name}: ${error.message}`);
    }
    return E.left(`${error}`);
  }
}

export async function selectElementAttr(
  browser: Browser,
  sourceHtml: string,
  elementSelector: string,
  attributeName: string
): Promise<AttrSelection> {
  const page: Page = await browser.newPage();
  try {
    await page.setContent(sourceHtml, {
      timeout: 4000,
      waitUntil: 'domcontentloaded',
    });

    return await selectElementAttrP(page, elementSelector, attributeName);
  } catch (error) {
    // if (error instanceof puppeteerErrors.TimeoutError) {
    //   // TODO Do something if this is a timeout.
    // }
    if (error instanceof Error) {
      return E.left(`${error.name}: ${error.message}`);
    }
    return E.left(`${error}`);
  }
}
