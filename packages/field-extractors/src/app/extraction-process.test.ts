import path from 'path';
import _ from 'lodash';
import { getConsoleAndFileLogger } from '@watr/commonlib';
import fs from 'fs-extra';
import cproc from 'child_process';
import Async from 'async';

import { createBrowserPool } from '@watr/spider';
import { AbstractFieldAttempts } from './extraction-rules';
import { runFieldExtractor } from '../run-main';
import { readUrlFetchData } from '..';
import { initExtractionEnv } from './extraction-process';
import { ExtractionSharedEnv } from './extraction-prelude';

describe('Field Extraction Pipeline', () => {
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
    const browserPool = createBrowserPool(log);
    await Async.mapSeries(examples, Async.asyncify(async (example: string) => {
      const entryPath = path.join(testScratchDir, 'spidered-corpus', example);
      const urlFetchData = readUrlFetchData(entryPath);
      expect(urlFetchData).toBeDefined();
      if (urlFetchData === undefined) {
        console.log('ERROR: no urlFetchData found');
        return;
      }
      const sharedEnv: ExtractionSharedEnv = {
        log, browserPool, urlFetchData
      };
      const env = await initExtractionEnv(entryPath, sharedEnv);
      return runFieldExtractor(env, AbstractFieldAttempts);
    }));

    await browserPool.shutdown()

  });
});
