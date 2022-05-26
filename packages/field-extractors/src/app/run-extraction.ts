import _ from 'lodash';

import {
  ensureArtifactDirectories,
  readCorpusJsonFile,
  writeCorpusJsonFile,
  getServiceLogger,
  asyncEach,
} from '@watr/commonlib';



import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import Async from 'async';
import { createBrowserPool, createSpiderEnv, initScraper, UrlFetchData } from '@watr/spider';

import {
  Transform,
  PerhapsW,
  ExtractionEnv,
} from '~/predef/extraction-prelude';

import {
  FieldExtractionAttempts,
  SpiderAndExtractionTransform,
} from '~/core/extraction-rules';

import { Page } from 'puppeteer';
import { CanonicalFieldRecords, FieldRecord } from '~/predef/extraction-records';
import { initExtractionEnv } from '~/core/extraction-primitives';


const extractionRecordFileName = 'extraction-records.json';

export function readUrlFetchData(entryPath: string,): UrlFetchData | undefined {
  return readCorpusJsonFile<UrlFetchData>(entryPath, '.', 'metadata.json');
}

export async function runFieldExtractor(
  exEnv: ExtractionEnv,
  extractionPipeline: Transform<unknown, unknown>
): Promise<PerhapsW<unknown>> {
  const { urlFetchData, browserPool, browserPageCache, browserInstance } = exEnv;

  const res = await extractionPipeline(TE.right([urlFetchData, exEnv]))();

  const browserPages = _.map(_.toPairs(browserPageCache), ([, p]) => p);

  await Async.each(browserPages, Async.asyncify(async (page: Page) => page.close()));

  await browserPool.release(browserInstance);

  return res;
}

type RMArgs = {
  corpusRoot: string,
  url: string,
  clean: boolean,
};

export async function runMainExtractFields({
  corpusRoot,
  url,
  clean
}: RMArgs): Promise<void> {
  const log = getServiceLogger('field-extractor');

  const scraper = initScraper({ corpusRoot });

  const scrapedUrl = await scraper.scrapeUrl(url, clean);

  const { browserPool } = scraper;

  if (E.isRight(scrapedUrl)) {
    log.info('Field Extraction starting..');
    const urlFetchData = scrapedUrl.right;

    const spiderEnv = await createSpiderEnv(log, browserPool, corpusRoot, new URL(url));
    const exEnv = initExtractionEnv(spiderEnv, urlFetchData);
    await extractFieldsForEntry(exEnv);
    await browserPool.shutdown();
  }
}

export async function extractFieldsForEntry(
  exEnv: ExtractionEnv,
): Promise<void> {
  const { log, entryPath } = exEnv;
  log.info(`extracting field in ${entryPath()}`);

  ensureArtifactDirectories(entryPath());

  const res = await runFieldExtractor(exEnv, FieldExtractionAttempts);

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


export async function runMainSpiderAndExtractFields({
  corpusRoot,
  url,
  clean
}: RMArgs): Promise<void> {
  const log = getServiceLogger('field-extractor');
  const browserPool = createBrowserPool();
  const spiderEnv = await createSpiderEnv(log, browserPool, corpusRoot, new URL(url));
  const { entryPath, } = spiderEnv;
  ensureArtifactDirectories(entryPath());

  const init = new URL(url);
  // const res = await runFieldExtractor(spiderEnv, SpiderAndExtractionTransform);
  const res = await SpiderAndExtractionTransform(TE.right([init, spiderEnv]))();

  // const browserPages = _.map(_.toPairs(browserPageCache), ([, p]) => p);

  // await asyncEach(browserPages, (page: Page) => page.close());

  // const scraper = initScraper({ corpusRoot });

  // const scrapedUrl = await scraper.scrapeUrl(url, clean);

  // const { browserPool } = scraper;

  // if (E.isRight(scrapedUrl)) {
  //   log.info('Field Extraction starting..');
  //   const urlFetchData = scrapedUrl.right;

  //   const spiderEnv = await createSpiderEnv(log, browserPool, corpusRoot, new URL(url));
  //   const exEnv = await initExtractionEnv(spiderEnv, urlFetchData);
  //   await extractFieldsForEntry(exEnv);
  //   await browserPool.shutdown();
  // }
  await browserPool.shutdown();
}

export async function spiderAndExtractFieldsForEntry(
  exEnv: ExtractionEnv,
): Promise<void> {
  const { log, entryPath } = exEnv;
  log.info(`extracting field in ${entryPath()}`);

  ensureArtifactDirectories(entryPath());

  const res = await runFieldExtractor(exEnv, FieldExtractionAttempts);

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


export function getEnvCanonicalFields(env: ExtractionEnv): CanonicalFieldRecords {
  const { fieldRecs } = env;

  const fieldRecords: FieldRecord[] = _.flatMap(_.toPairs(fieldRecs), ([fieldName, fieldInstances]) => {
    if (fieldName === 'author') {
      return fieldInstances;
    }
    const fi0 = fieldInstances[0];
    return [fi0];
  });

  const canonicalRecords: CanonicalFieldRecords = {
    fields: fieldRecords
  };
  return canonicalRecords;
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
    entryPath(),
    'extracted-fields',
    extractionRecordFileName,
    finalOutput,
    /* overwrite= */true
  );

  const canonicalRecords = getEnvCanonicalFields(env);

  writeCorpusJsonFile(
    entryPath(),
    'extracted-fields',
    'canonical-fields.json',
    canonicalRecords,
    /* overwrite= */true
  );
}

export function readCanonicalFieldRecord(
  entryPath: string,
): CanonicalFieldRecords | undefined {
  const records = readCorpusJsonFile<CanonicalFieldRecords>(
    entryPath,
    'extracted-fields',
    'canonical-fields.json',
  );

  return records;
}
