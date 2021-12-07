import 'chai/register-should';
import path from 'path';
import _ from 'lodash';
import { getConsoleAndFileLogger, readCorpusJsonFile } from '@watr/commonlib';
import fs from 'fs-extra';
import cproc from 'child_process';
import Async from 'async';


import { Metadata } from '@watr/spider';
import { AbstractFieldAttempts } from './extraction-rules';
import { runFieldExtractor } from '../run-main';

describe('Field Extraction Pipeline', () => {
  const testCorpus = './test/resources/spidered-corpus';
  const testScratchDir = './test-scratch.d';

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
    // const log = getBasicConsoleLogger();

    const logLevel = 'debug';
    const logfilePath = testScratchDir;
    const log = getConsoleAndFileLogger(logfilePath, logLevel);
    await Async.mapSeries(examples, async example => {
      const entryPath = path.join(testScratchDir, 'spidered-corpus', example);
      const metadata = readCorpusJsonFile<Metadata>(entryPath, '.', 'metadata.json');
      expect(metadata).toBeDefined();
      if (metadata === undefined) {
        console.log('ERROR: no metadata found');
        return;
      }
      return runFieldExtractor({ entryPath, log }, metadata, AbstractFieldAttempts);
    });
  });
});
