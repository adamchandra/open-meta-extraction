import _ from 'lodash';
import * as E from 'fp-ts/Either';
import * as TE from 'fp-ts/TaskEither';
import { differenceInMilliseconds } from 'date-fns';

import {
  prettyPrint,
  asyncDoUntil,
  getServiceLogger,
  getCorpusRootDir,
  delay,
} from '@watr/commonlib';

import { OpenReviewGateway } from './openreview-gateway'
import { CanonicalFieldRecords, getEnvCanonicalFields, SpiderAndExtractionTransform } from '@watr/field-extractors';

import { createBrowserPool, createSpiderEnv } from '@watr/spider';

import { Logger } from 'winston';
import { ShadowDB } from './shadow-db';

export class ExtractionService {
  log: Logger;
  gate: OpenReviewGateway;
  shadow: ShadowDB;

  constructor() {
    this.log = getServiceLogger('ExtractionService');
    this.gate = new OpenReviewGateway();
    this.shadow = new ShadowDB()
  }

  async runRelayExtract({ count, postResultsToOpenReview }: RunRelayExtract) {
    const self = this;
    let currCount = 0;
    const runForever = count === 0;

    const corpusRoot = getCorpusRootDir();
    const browserPool = createBrowserPool();

    const maxRate = 5 * 1000;// 5 second max spidering rate
    let currTime = new Date();

    async function stopCondition(): Promise<boolean> {
      await browserPool.clearCache();
      const atCountLimit = currCount >= count;
      currTime = await self.rateLimit(currTime, maxRate);
      return atCountLimit && !runForever;
    }

    return asyncDoUntil(
      async () => {

        const nextSpiderable = await this.shadow.getNextAvailableUrl();

        if (nextSpiderable === undefined) {
          return;
        }

        currCount += 1;

        const noteId = nextSpiderable._id;
        const url = nextSpiderable.requestUrl;
        self.log.info(`Starting URL: ${url}`);

        const spiderEnv = await createSpiderEnv(self.log, browserPool, corpusRoot, new URL(url));
        const init = new URL(url);

        const fieldExtractionResults = await SpiderAndExtractionTransform(TE.right([init, spiderEnv]))();

        if (E.isLeft(fieldExtractionResults)) {
          return await this.shadow.releaseSpiderableUrl(nextSpiderable, 'extractor:fail');
        }

        const [, extractionEnv] = fieldExtractionResults.right;

        const { status, responseUrl } = extractionEnv.urlFetchData;
        let httpStatus = 0;
        try { httpStatus = Number.parseInt(status); } catch {}

        const canonicalFields = getEnvCanonicalFields(extractionEnv);

        prettyPrint({ canonicalFields });

        const theAbstract = getCanonicalAbstract(canonicalFields);
        const hasAbstract = theAbstract !== undefined;
        const pdfLink = getCanonicalPdfLink(canonicalFields);
        const hasPdfLink = pdfLink !== undefined;


        if (postResultsToOpenReview) {
          // TODO move hasField logic into ShadowDB
          if (hasAbstract) {
            await this.shadow.doUpdateNoteField(noteId, 'abstract', theAbstract);
          }
          if (hasPdfLink) {
            await this.shadow.doUpdateNoteField(noteId, 'pdf', pdfLink);
          }
        }

        // await upsertHostStatus(noteId, 'extractor:success', {
        //   hasAbstract,
        //   hasPdfLink,
        //   httpStatus,
        //   response: responseUrl
        // });

      },
      stopCondition
    ).finally(() => {
      return browserPool.shutdown();
    });
  }

  async rateLimit(prevTime: Date, maxRateMs: number): Promise<Date> {
    const currTime = new Date();
    const elapsedMs = differenceInMilliseconds(currTime, prevTime);
    const waitTime = maxRateMs - elapsedMs;

    if (waitTime > 0) {
      this.log.info(`Delaying ${waitTime / 1000} seconds...`);
      await delay(waitTime);
    }
    return currTime;
  }
}

type RunRelayExtract = {
  count: number,
  postResultsToOpenReview: boolean
};


function getCanonicalAbstract(canonicalFields: CanonicalFieldRecords): string | undefined {
  const abstracts = _.filter(canonicalFields.fields, (field) => field.name === 'abstract');
  const clippedAbstracts = _.filter(canonicalFields.fields, (field) => field.name === 'abstract-clipped');
  let theAbstract: string | undefined;
  if (abstracts.length > 0) {
    theAbstract = abstracts[0].value;
  } else if (clippedAbstracts.length > 0) {
    theAbstract = clippedAbstracts[0].value;
  }

  return theAbstract;
}

function getCanonicalPdfLink(canonicalFields: CanonicalFieldRecords): string | undefined {
  const pdfLinks = _.filter(canonicalFields.fields, (field) => field.name === 'pdf-link');
  if (pdfLinks.length > 0) {
    return pdfLinks[0].value;
  }
}
