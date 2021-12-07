import _ from 'lodash';

import { isLeft, isRight } from 'fp-ts/Either';
import { prettyPrint, putStrLn, stripMargin, launchBrowser } from '@watr/commonlib';
import Async from 'async';
import { selectElementAttr, _queryOne, _queryAll, expandCaseVariations } from './html-queries';


const tmpHtml = stripMargin(`
|<html>
|  <head>
|    <meta name="citation_author" content="Holte, Robert C." />
|    <meta name="citation_author" content="Burch, Neil" />
|    <meta name="citation_title" content="Automatic move pruning for single-agent search" />
|    <meta name="dc.Creator" content="Adam" />
|    <meta name="dc.creator" content="adam" />
|    <meta property="og:description" content="success: We consider a new learning model in which a joint distributi" />
|  </head>
|
|  <body>
|    <section class="Abstract" id="Abs1" tabindex="-1" lang="en" xml:lang="en">
|      <h2 class="Heading">
|        Abstract
|      </h2>
|      <p class="Para">
|        success: We present
|      </p>
|    </section>
|    <a class="show-pdf" href="/success:pdf">PDF</a>
|
|    <div class="Abstracts u-font-serif" id="abstracts">
|        <div class="abstract author" id="aep-abstract-id6">
|            <h2 class="section-title u-h3 u-margin-l-top u-margin-xs-bottom">
|                Abstract
|            </h2>
|            <div id="aep-abstract-sec-id7">
|                <p>
|                    success1
|                </p>
|                <p>
|                    success2
|                </p>
|            </div>
|        </div>
|    </div>
|
|  </body>
|</html>
`);


describe('HTML jquery-like css queries', () => {
  it('smokescreen', async () => {
    const attr0 = await selectElementAttr(tmpHtml, 'meta[name=citation_title]', 'content');
    const attr1 = await selectElementAttr(tmpHtml, 'meta[name=citation_title]', 'content_');
    const attr2 = await selectElementAttr(tmpHtml, 'meta[name=empty]', 'content');
    expect(isRight(attr0)).toBeTruthy();
    expect(isLeft(attr1)).toBeTruthy();
    expect(isLeft(attr2)).toBeTruthy();

    // done();
  });


  it('should run assorted css queries', async () => {
    const browser = await launchBrowser();

    const examples: [string, RegExp][] = [
      ['div#abstracts > div.abstract > div', /success1/],
      ['div#abstracts > div.abstract > div', /success2/],
      ['section.abstract > p.para', /success:/],
      ['section.Abstract > p.Para', /success:/],
      ['section[class=Abstract] > p[class="Para"]', /success:/],
      ['section#abs1.abstract > p.para', /success:/],
      ['meta[property="og:description"]', /success:/],
      ['a.show-pdf', /success:pdf/],
    ];

    await Async.eachSeries(examples, Async.asyncify(async ([query, regexTest]) => {
      const maybeResult = await _queryOne(browser, tmpHtml, query);
      if (isRight(maybeResult)) {
        const elem = maybeResult.right;
        const outerHtml = await elem.evaluate(e => e.outerHTML);
        // prettyPrint({ query, outerHtml });
        expect(regexTest.test(outerHtml)).toBe(true);
      } else {
        const error = maybeResult.left;
        console.log('error', query, error);
      }
      expect(isRight(maybeResult)).toBe(true);
    }));

    await browser.close();
    // done();
  });

  it('should run assorted css multi-queries', async () => {
    const browser = await launchBrowser();

    const examples: [string, RegExp[]][] = [
      // ['meta[name=citation_author]', [/Holte/, /Burch/]],
      ['meta[name="dc.Creator"]', [/Adam/]],
      ['meta[name="dc.creator"]', [/adam/]],
      ['meta[name~="dc.creator"],meta[name~="dc.Creator"]', [/Adam/, /adam/]],
    ];


    await Async.forEachOfSeries(examples, Async.asyncify(async ([query, ], exampleNum) => {
      const maybeResult = await _queryAll(browser, tmpHtml, query);
      putStrLn(`Example #${exampleNum}`);
      if (isRight(maybeResult)) {
        const elems = maybeResult.right;
        await Async.forEachOfSeries(elems, Async.asyncify(async (elem, index) => {
          const outerHtml = await elem.evaluate(e => e.outerHTML);
          // prettyPrint({ query, outerHtml, result: index });
          // const regexTest: RegExp = _.get(regexTests, index);
          // expect(regexTest.test(outerHtml)).toBe(true);
        }));
      } else {
        const error = maybeResult.left;
        console.log('error', query, error);
      }
    }));

    await browser.close();
    // done();
  });

  it('should create all expansions', () => {
    const cases1 = expandCaseVariations('A.B.C', (n) => `meta[name="${n}"]`);
    const cases2 = expandCaseVariations('DC.Creator', (n) => `meta[name="${n}"]`);
    // prettyPrint({ cases1, cases2 });
  });

  it('should downcase attributes', async () => {
    const browser = await launchBrowser();

    const examples: [string, RegExp[]][] = [
      // ['meta[name=citation_author]', [/Holte/, /Burch/]],
      ['meta[name="dc.Creator"]', [/Adam/]],
      ['meta[name="dc.creator"]', [/adam/]],
      ['meta[name~="dc.creator"],meta[name~="dc.Creator"]', [/Adam/, /adam/]],
    ];

    await Async.eachSeries(examples, Async.asyncify(async ([query, ]) => {
      const maybeResult = await _queryAll(browser, tmpHtml, query);
      if (isRight(maybeResult)) {
        const elems = maybeResult.right;
        await Async.forEachOfSeries(elems, Async.asyncify(async (elem, index) => {
          const outerHtml = await elem.evaluate(e => e.outerHTML);
          prettyPrint({ query, outerHtml, index });
          // const regexTest: RegExp = _.get(regexTests, index);
          // expect(regexTest.test(outerHtml)).toBe(true);
        }));
      } else {
        const error = maybeResult.left;
        console.log('error', query, error);
      }
    }));

    await browser.close();
    // done();
  });
});
