import _ from 'lodash';

import {
  // streamPump,
  // walkScrapyCacheCorpus,
  // getConsoleAndFileLogger,
  // hasCorpusFile,
  // setLogLabel,
  // expandDir,
  // putStrLn,
  // radix,
  ensureArtifactDirectories,
  readCorpusJsonFile,
  writeCorpusJsonFile,
  getServiceLogger,
} from '@watr/commonlib';



import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import Async from 'async';
import { createBrowserPool, UrlFetchData } from '@watr/spider';
import { initExtractionEnv } from './app/extraction-process';
import {
  Arrow,
  PerhapsW,
  ExtractionEnv,
  ExtractionSharedEnv
} from './app/extraction-prelude';
import { AbstractFieldAttempts } from './app/extraction-rules';

import { arglib } from '@watr/commonlib';
import { Page } from 'puppeteer';
import { CanonicalFieldRecords, FieldRecord } from './core/extraction-records';

const { opt, config, registerCmd } = arglib;

const extractionRecordFileName = 'extraction-records.json';

export async function runFieldExtractor(
  exEnv: ExtractionEnv,
  extractionPipeline: Arrow<unknown, unknown>
): Promise<PerhapsW<unknown>> {
  const { urlFetchData, browserPool, browserPageCache, browserInstance } = exEnv;

  const res = await extractionPipeline(TE.right([urlFetchData, exEnv]))();

  const browserPages = _.map(_.toPairs(browserPageCache), ([, p]) => p);

  await Async.each(browserPages, Async.asyncify(async (page: Page) => page.close()));

  await browserPool.release(browserInstance);

  return res;
}

export async function runMainExtractFields(
  corpusRoot: string,
  urlString: string,
): Promise<void> {
  const log = getServiceLogger('field-extractor');

      // const urlFetchData = readUrlFetchData(entryPath);
      // const browserPool = createBrowserPool();

      // return {
      //   log,
      //   urlFetchData,
      //   browserPool,
      // };
      // await extractFieldsForEntry(exEnv);

}


export function readUrlFetchData(entryPath: string,): UrlFetchData | undefined {
  return readCorpusJsonFile<UrlFetchData>(entryPath, '.', 'metadata.json');
}

export async function extractFieldsForEntry(
  exEnv: ExtractionEnv,
): Promise<void> {
  const { log, entryPath } = exEnv;
  log.info(`extracting field in ${entryPath}`);

  ensureArtifactDirectories(entryPath);

  const res = await runFieldExtractor(exEnv, AbstractFieldAttempts);

  if (E.isRight(res)) {
    log.info('writing extraction records');
    const [, env] = res.right;
    writeExtractionRecords(env, ['Extraction Success']);
  } else {
    const [ci, env] = res.left;
    log.error('error extracting records');
    writeExtractionRecords(env, ['Extraction Failure', `${ci}`]);
  }
}


function writeExtractionRecords(env: ExtractionEnv, messages: string[]) {
  const { entryPath, fieldRecs } = env;
  const reshaped = _.mapValues(fieldRecs, (value) => {
    return {
      count: value.length,
      instances: value
    };
  });
  const output = {
    fields: reshaped
  };

  const empty = {
    messages,
    fields: {
      title: { count: 0 },
      abstract: { count: 0 },
      'abstract-clipped': { count: 0 },
      author: { count: 0 },
      'pdf-link': { count: 0 },
      'pdf-path': { count: 0 },
    }
  };

  const finalOutput = _.merge({}, empty, output);

  writeCorpusJsonFile(
    entryPath,
    'extracted-fields',
    extractionRecordFileName,
    finalOutput,
    /* overwrite= */true
  );

  const fieldRecords: FieldRecord[] = _.flatMap(_.toPairs(fieldRecs), ([fieldName, fieldInstances]) => {
    if (fieldName === 'author') {
      const nameValueRecs = _.flatMap(fieldInstances, fi => {
        const { name, value } = fi;
        if (value === undefined) return [];
        return [{ name, value }];
      });
      return nameValueRecs;
    }
    const { name, value } = fieldInstances[0];
    if (value === undefined) return [];
    return [{ name, value }];
  });

  const canonicalRecords: CanonicalFieldRecords = {
    fields: fieldRecords
  };

  writeCorpusJsonFile(
    entryPath,
    'extracted-fields',
    'canonical-fields.json',
    canonicalRecords,
    /* overwrite= */true
  );
}

export function getCanonicalFieldRecord(
  entryPath: string,
): CanonicalFieldRecords | undefined {
  const records = readCorpusJsonFile<CanonicalFieldRecords>(
    entryPath,
    'extracted-fields',
    'canonical-fields.json',
  );

  return records;
}


registerCmd(
  arglib.YArgs,
  'extract-url',
  'spider and extract field from given URL',
  config(
    opt.cwd,
    opt.existingDir('corpus-root: root directory for corpus files'),
    opt.ion('url', {
      type: 'string',
      required: true
    }),
  )
)((args: any) => {
  const { corpusRoot, url } = args;

  runMainExtractFields(
    corpusRoot,
    url
  ).then(() => {
    console.log('done');
  });
});
