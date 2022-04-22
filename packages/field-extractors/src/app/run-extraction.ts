import _ from 'lodash';

import {
  ensureArtifactDirectories,
  readCorpusJsonFile,
  writeCorpusJsonFile,
  getServiceLogger,
} from '@watr/commonlib';



import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import Async from 'async';
import { initScraper, UrlFetchData } from '@watr/spider';

import {
  Arrow,
  PerhapsW,
  ExtractionEnv,
  ExtractionSharedEnv,
} from '~/predef/extraction-prelude';

import { AbstractFieldAttempts } from '~/core/extraction-scripts';

import { Page } from 'puppeteer';
import { CanonicalFieldRecords, FieldRecord } from '~/predef/extraction-records';
import { initExtractionEnv } from '~/core/extraction-primitives';


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

  const scraper = await initScraper({ corpusRoot });

  const scrapedUrl = await scraper.scrapeUrl(url, clean);

  const { browserPool } = scraper;

  if (E.isRight(scrapedUrl)) {
    log.info('Field Extraction starting..')
    const urlFetchData = scrapedUrl.right;
    const sharedEnv: ExtractionSharedEnv = {
      log,
      browserPool,
      urlFetchData
    };

    const entryPath = scraper.getUrlCorpusEntryPath(url);
    const exEnv = await initExtractionEnv(entryPath, sharedEnv);
    await extractFieldsForEntry(exEnv);
  }
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
