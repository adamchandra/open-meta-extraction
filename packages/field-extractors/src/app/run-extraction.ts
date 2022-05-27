import _ from 'lodash';

import {
  ensureArtifactDirectories,
  readCorpusJsonFile,
  getServiceLogger,
} from '@watr/commonlib';


import * as TE from 'fp-ts/TaskEither';
import { createBrowserPool, createSpiderEnv, UrlFetchData } from '@watr/spider';

import {
  ExtractionEnv,
} from '~/predef/extraction-prelude';

import {
  SpiderAndExtractionTransform,
} from '~/core/extraction-rules';

import { CanonicalFieldRecords, FieldRecord } from '~/predef/extraction-records';

export function readUrlFetchData(entryPath: string,): UrlFetchData | undefined {
  return readCorpusJsonFile<UrlFetchData>(entryPath, '.', 'metadata.json');
}

type RMArgs = {
  corpusRoot: string,
  url: string,
  clean: boolean,
};

export async function runMainSpiderAndExtractFields({
  corpusRoot,
  url,
}: RMArgs): Promise<void> {
  const log = getServiceLogger('field-extractor');
  const browserPool = createBrowserPool();
  const spiderEnv = await createSpiderEnv(log, browserPool, corpusRoot, new URL(url));
  const { entryPath, } = spiderEnv;
  ensureArtifactDirectories(entryPath());

  const init = new URL(url);

  await SpiderAndExtractionTransform(TE.right([init, spiderEnv]))();

  //   if (E.isRight(res)) {
  //     log.info('writing extraction records');
  //     const [, env] = res.right;
  //     writeExtractionRecords(env, ['Extraction Success']);
  //   } else {
  //     const [ci, env] = res.left;
  //     log.error('error extracting records');
  //     writeExtractionRecords(env, ['Extraction Failure', `${ci}`]);
  //   }

  await browserPool.shutdown();
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
