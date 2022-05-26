import path from 'path';
import _ from 'lodash';
import fs from 'fs-extra';
import cproc from 'child_process';
import Async from 'async';

import { getConsoleAndFileLogger, setLogEnvLevel } from '@watr/commonlib';
import { FieldExtractionAttempts } from '~/core/extraction-rules';
import { initExtractionEnv } from '~/core/extraction-primitives';

import { readUrlFetchData, runFieldExtractor } from './run-extraction';
import { createBrowserPool, createSpiderEnv } from '@watr/spider';

describe('Field Extraction Pipeline', () => {
  setLogEnvLevel('silly');
  const testCorpus = './test/resources/spidered-corpus';
  const testScratchDir = './test.scratch.d';

  beforeEach(() => {
    fs.emptyDirSync(testScratchDir);
    fs.rmdirSync(testScratchDir);
    fs.mkdirpSync(testScratchDir);
    // TODO don't use linux shell commands here:
    cproc.execSync(`cp -rl ${testCorpus} ${testScratchDir}/`);
  });

  it('should run extraction rules', async () => {
    const examples = [
      '20019', // arxiv.org
      // '22dae',
      // '20248',
      // '22133',
      // '22168'
    ];

    const logLevel = 'debug';
    const logfilePath = testScratchDir;
    const log = getConsoleAndFileLogger(logfilePath, logLevel);
    const browserPool = createBrowserPool();
    await Async.mapSeries(examples, Async.asyncify(async (example: string) => {
      const entryPath = path.join(testScratchDir, 'spidered-corpus', example);
      const urlFetchData = readUrlFetchData(entryPath);
      expect(urlFetchData).toBeDefined();
      if (urlFetchData === undefined) {
        console.log('ERROR: no urlFetchData found');
        return;
      }

      const url = urlFetchData.requestUrl;

      const spiderEnv = await createSpiderEnv(log, browserPool, testScratchDir, new URL(url));
      const env = initExtractionEnv(spiderEnv, urlFetchData);

      return runFieldExtractor(env, FieldExtractionAttempts);
    }));

    await browserPool.shutdown();

  });
});
