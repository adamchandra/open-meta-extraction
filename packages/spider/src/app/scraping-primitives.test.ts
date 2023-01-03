import _ from 'lodash';

import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import { createSpiderEnv, getHttpResponseBody, httpResponseToUrlFetchData, scrapeUrl } from './scraping-primitives';
import { compose, SpiderEnv, through } from '~/core/taskflow-defs';
import { getServiceLogger, prettyPrint, putStrLn } from '@watr/commonlib';
import { createBrowserPool, ScriptablePageInstanceOptions } from '~/core/browser-pool';

describe('scraping primitives', () => {
  const corpusRoot = 'test.d';
  it('should scrape a simple url', async () => {
    const url = new URL('http://example.com')
    const log = getServiceLogger('scraper')

    const browserPool = createBrowserPool();

    const env: SpiderEnv = await createSpiderEnv(log, browserPool, corpusRoot, url);

    const spiderPipeline = compose(
      scrapeUrl(),
      httpResponseToUrlFetchData
    );

    const pipeline = spiderPipeline(TE.right([url, env]));

    const testPipeline = pipe(
      pipeline,
      through((succ) => {
        prettyPrint({ succ })
      })
    )
    await testPipeline();

    await browserPool.release(env.browserInstance)
    await browserPool.shutdown()
  });


  it('should use a page supporting javascript if needed', async () => {
    const url = new URL('https://linkinghub.elsevier.com/retrieve/pii/S0893608007001189')
    const log = getServiceLogger('scraper')

    const browserPool = createBrowserPool();

    const env: SpiderEnv = await createSpiderEnv(log, browserPool, corpusRoot, url);

    const spiderPipeline = compose(
      scrapeUrl(ScriptablePageInstanceOptions),
      getHttpResponseBody,
      // httpResponseToUrlFetchData
    );

    const pipeline = spiderPipeline(TE.right([url, env]));

    putStrLn(`constructing testPipeline`)

    const testPipeline = pipe(
      pipeline,
      through((succ) => {
        prettyPrint({ succ })
      })
    )
    await testPipeline();

    putStrLn(`Finished testPipeline`)

    await browserPool.release(env.browserInstance)
    await browserPool.shutdown()
  });

});
