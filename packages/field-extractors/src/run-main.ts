import _ from 'lodash';

import {
  streamPump,
  walkScrapyCacheCorpus,
  ensureArtifactDirectories,
  getConsoleAndFileLogger,
  readCorpusJsonFile,
  writeCorpusJsonFile,
  hasCorpusFile,
  setLogLabel,
  expandDir,
  putStrLn,
  radix,
} from '@watr/commonlib';

import parseUrl from 'url-parse';

import path from 'path';

import fs from 'fs-extra';

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

const extractionRecordFileName = 'extraction-records.json';

export interface FieldRecord {
  name: string;
  value: string;
}

export interface CanonicalFieldRecords {
  noteId?: string;
  url?: string;
  title?: string;
  fields: FieldRecord[];
}

export async function runMainInitFilters(
  corpusRoot: string,
): Promise<[radix.Radix<Set<string>>, radix.Radix<number>]> {
  const dirEntryStream = walkScrapyCacheCorpus(corpusRoot);

  const radCounts = radix.createRadix<number>();
  const radAccum = radix.createRadix<Set<string>>();

  const pumpBuilder = streamPump.createPump()
    .viaStream<string>(dirEntryStream)
    .throughF((entryPath) => {
      const metadata = readCorpusJsonFile<UrlFetchData>(entryPath, '.', 'metadata.json');

      if (metadata === undefined) {
        return;
      }

      const { responseUrl } = metadata;
      const parsedUrl = parseUrl(responseUrl);
      const { host } = parsedUrl;
      const paths = parsedUrl.pathname.split('/');
      const [, path1] = paths.slice(0, -1);
      const hostAndPath = `${host}/${path1}`;
      const lookup = {
        host: {
          okay: host,
          path: {
            okay: hostAndPath
          }
        },

      };
      radix.radUpsert(radCounts, [host], (count) => (count === undefined ? 1 : count + 1));
      if (path1 !== undefined) {
        radix.radUpsert(radCounts, [host, path1], (count) => (count === undefined ? 1 : count + 1));
      }

      const hasExtractionRecord = hasCorpusFile(entryPath, 'extracted-fields', extractionRecordFileName);

      if (!hasExtractionRecord) {
        return;
      }

      const extractedFieldsDir = path.join(entryPath, 'extracted-fields');
      if (!fs.existsSync(extractedFieldsDir)) {
        return;
      }
      const exdir = expandDir(extractedFieldsDir);
      const gtFiles = _.filter(exdir.files, f => f.endsWith('.gt'));

      _.each(gtFiles, f => {
        const nameParts = path.basename(f).split(/\./);
        const gtNamePart = nameParts[nameParts.length - 2];
        putStrLn(`gtNamePart = ${gtNamePart}`);

        const dotted = gtNamePart.replace(/_/g, '.');
        const v = _.get(lookup, dotted);

        radix.radUpsert(
          radAccum, dotted, (strs?: Set<string>) => (strs === undefined ? (new Set<string>().add(v)) : strs.add(v))
        );
      });
    });

  return pumpBuilder.toPromise()
    .then(() => {
      putStrLn('URL Host / Path counts');
      const pathCounts: [number, string][] = [];
      radix.radTraverseValues(radCounts, (path, count) => {
        const jpath = _.join(path, '/');
        pathCounts.push([count, jpath]);
      });

      const sorted = _.sortBy(pathCounts, ([c]) => -c);
      _.each(sorted, ([count, path]) => {
        putStrLn(`    ${count} : ${path}`);
      });

      putStrLn('Ground Truth labels');
      radix.radTraverseValues(radAccum, (path, strs) => {
        putStrLn(`    ${_.join(path, ' _ ')} =>`);
        strs.forEach(s => {
          putStrLn(`      ${s}`);
        });
      });
      return [radAccum, radCounts];
    });
}

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
  logpath: string,
  logLevel: string,
  _dropN: number,
  _takeN: number,
  pathFilter: string,
  urlFilter: string,
): Promise<void> {
  const logFilename = 'field-extractor-log.json';
  const logfilePath = path.join(logpath, logFilename);
  const log = getConsoleAndFileLogger(logfilePath, logLevel);

  const dirEntryStream = walkScrapyCacheCorpus(corpusRoot);

  // const [radAccum, radCount] = await runMainInitFilters(corpusRoot);

  const pumpBuilder = streamPump.createPump()
    .viaStream<string>(dirEntryStream)
    .filter((entryPath) => entryPath !== undefined)
    .filter((entryPath) => {
      const pathRE = new RegExp(pathFilter);
      return pathRE.test(entryPath);
    })
    .initEnv<ExtractionSharedEnv>((entryPath) => {
      if (entryPath === undefined) throw new Error('invalid state: entryPath is undefined');
      setLogLabel(log, entryPath);
      const urlFetchData = readUrlFetchData(entryPath);
      const browserPool = createBrowserPool(log);

      return {
        log,
        urlFetchData,
        browserPool,
      };
    })
    .throughF<ExtractionEnv>(async (entryPath, sharedEnv) => {
      return await initExtractionEnv(entryPath, sharedEnv);
    })
    .filter((exEnv) => {
      const { urlFetchData } = exEnv;
      if (urlFetchData === undefined) return false;

      const url = urlFetchData.responseUrl;
      const re = new RegExp(urlFilter);
      return re.test(url);
    })
    .tap(async (exEnv) => {
      await extractFieldsForEntry(exEnv);
    });

  return pumpBuilder.toPromise()
    .then(() => { });
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

import { arglib } from '@watr/commonlib';
import { Page } from 'puppeteer';

const { opt, config, registerCmd } = arglib;

registerCmd(
  arglib.YArgs,
  'run-field-extractors',
  'run field extractors',
  config(
    opt.cwd,
    opt.existingDir('corpus-root: root directory for corpus files'),
    opt.ion('drop', {
      type: 'number',
      required: false,
      default: 0
    }),
    opt.ion('take', {
      type: 'number',
      required: false,
      default: Number.MAX_SAFE_INTEGER,
    }),
    opt.ion('log-level', {
      required: false,
      default: 'info'
    }),
    opt.ion('path-filter', {
      type: 'string',
      required: false,
      default: '.*'
    }),
    opt.ion('url-filter', {
      type: 'string',
      required: false,
      default: '.*'
    }),
  )
)((args: any) => {
  const { corpusRoot, logLevel, drop, take, pathFilter, urlFilter } = args;
  const logpath = corpusRoot;

  runMainExtractFields(
    corpusRoot,
    logpath,
    logLevel,
    drop,
    take,
    pathFilter,
    urlFilter
  ).then(() => {
    console.log('done');
  });
});
