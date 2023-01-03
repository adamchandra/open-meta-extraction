import { pipe } from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import {
  arglib,
  getServiceLogger,
  setLogEnvLevel,
  putStrLn
} from '@watr/commonlib';

import { createBrowserPool } from '~/core/browser-pool';

import {
  SpiderEnv,
  compose,
  through
} from '~/core/taskflow-defs';

import {
  cleanArtifacts,
  createSpiderEnv,
  getHttpResponseBody,
  httpResponseToUrlFetchData,
  scrapeUrl
} from './scraping-primitives';

const {
   opt,
  config,
  registerCmd
} = arglib;

export function registerCommands(yargv: arglib.YArgsT) {
  registerCmd(
    yargv,
    'spider-url',
    'spider the give URL, save results in corpus',
    config(
      opt.existingDir('corpus-root: root directory for corpus files'),
      opt.str('url'),
      opt.flag('clean', false),
      opt.logLevel('info'),
    )
  )(async (args: any) => {
    const { url, corpusRoot, clean, logLevel } = args;
    cleanArtifacts

    const log = getServiceLogger('spider')

    setLogEnvLevel(logLevel);

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
        putStrLn('Spider success:', succ)
      })
    )

    await testPipeline();
    await browserPool.release(env.browserInstance)
    await browserPool.shutdown()
  });
}
