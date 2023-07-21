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
  putStrLn,
} from '@watr/commonlib';

import { CanonicalFieldRecords, getEnvCanonicalFields, SpiderAndExtractionTransform } from '@watr/field-extractors';

import { createBrowserPool, createSpiderEnv } from '@watr/spider';

import { Logger } from 'winston';
import { ShadowDB } from './shadow-db';
import { WorkflowStatus } from '~/db/schemas';

export async function createExtractionService(): Promise<ExtractionService> {
  const s = new ExtractionService();
  await s.connect();
  return s;
}




export class ExtractionService {
  log: Logger;
  shadow: ShadowDB;

  constructor() {
    this.log = getServiceLogger('ExtractionService');
    this.shadow = new ShadowDB();
  }

  async connect() {
    await this.shadow.connect();
  }

  async close() {
    await this.shadow.close();
  }

  async updateWorkflowStatus(noteId: string, workflowStatus: WorkflowStatus): Promise<boolean> {
    const update = await this.shadow.mdb.updateUrlStatus(noteId, { workflowStatus });
    if (!update) {
      this.log.error(`Problem updating workflow status='${workflowStatus}' for note ${noteId}`)
    }
    return !!update;
  }

  async runExtractionLoop({ limit, postResultsToOpenReview }: RunRelayExtract) {
    const self = this;
    let currCount = 0;
    const runForever = limit === 0;

    const corpusRoot = getCorpusRootDir();
    const browserPool = createBrowserPool();

    const oneSecond = 1000;
    const oneMinute = 60 * oneSecond;
    const oneHour = 60 * oneMinute;

    const pauseIntervalAfterNoteExhaustion = 2 * oneHour;
    // Don't run faster than given rate
    const minTimePerIteration = 5 * oneSecond;
    let currTime = new Date();

    async function stopCondition(msg: string): Promise<boolean> {
      putStrLn(`stopCondition(msg=${msg})`);
      if (msg === 'done') {

        if (runForever) {
          // Pause before exiting.
          // PM2 will relaunch immediately
          await delay(pauseIntervalAfterNoteExhaustion)
        }

        return true;
      }
      await browserPool.clearCache();
      browserPool.report();
      const atCountLimit = currCount >= limit;
      prettyPrint({ atCountLimit, runForever })
      putStrLn(`stop? atCountLimit(${atCountLimit} = curr:${currCount} >= lim:${limit}`)
      if (atCountLimit && !runForever) {
        return true;
      }
      currTime = await self.rateLimit(currTime, minTimePerIteration);
      return atCountLimit && !runForever;
    }

    return asyncDoUntil(
      async () => {
        const nextNoteCursor = await this.shadow.getNextAvailableUrl();
        // update URL workflow status
        const msg = `nextNoteCursor=${nextNoteCursor?.noteId}; num=${nextNoteCursor?.noteNumber}`;
        putStrLn(msg);
        this.log.debug(msg);

        if (!nextNoteCursor) {
          this.log.info('No more spiderable URLs available');
          return 'done';
        }
        const nextUrlStatus = await this.shadow.getUrlStatusForCursor(nextNoteCursor);
        if (!nextUrlStatus) {
          throw new Error(`Invalid state: nextNoteCursor(${nextNoteCursor.noteId}) had not corresponding urlStatus`)
        }
        this.log.debug(`next Host = ${nextUrlStatus.requestUrl}`);

        currCount += 1;

        const noteId = nextUrlStatus._id;
        const url = nextUrlStatus.requestUrl;
        self.log.info(`Starting URL: ${url}`);
        await this.updateWorkflowStatus(noteId, 'processing');

        const spiderEnv = await createSpiderEnv(self.log, browserPool, corpusRoot, new URL(url));
        const init = new URL(url);
        self.log.debug(`Created Spidering Environment`);

        await this.updateWorkflowStatus(noteId, 'spider:begun');
        const fieldExtractionResults = await SpiderAndExtractionTransform(TE.right([init, spiderEnv]))()
          .catch(async error => {
            prettyPrint({ error })
            await this.updateWorkflowStatus(noteId, 'extractor:fail');
            throw error;
          });


        if (E.isLeft(fieldExtractionResults)) {
          const [errCode, { urlFetchData }] = fieldExtractionResults.left;
          self.log.debug(`Extraction Failed, exiting...`);

          const { status } = urlFetchData;
          let httpStatus = 0;
          try { httpStatus = Number.parseInt(status); } catch {}

          await this.shadow.mdb.updateUrlStatus(noteId, {
            httpStatus,
            // response: responseUrl
          });
          prettyPrint({ errCode, urlFetchData });

          await this.updateWorkflowStatus(noteId, 'extractor:fail');
          await this.shadow.releaseSpiderableUrl(nextNoteCursor);
          return 'continue';
        }

        self.log.debug(`Extraction succeeded, continuing...`);
        await this.updateWorkflowStatus(noteId, 'extractor:success');

        const [, extractionEnv] = fieldExtractionResults.right;

        const { status, responseUrl } = extractionEnv.urlFetchData;
        let httpStatus = 0;
        try { httpStatus = Number.parseInt(status); } catch {}

        const canonicalFields = getEnvCanonicalFields(extractionEnv);


        await this.updateWorkflowStatus(noteId, 'extractor:success');
        const theAbstract = chooseCanonicalAbstract(canonicalFields);
        const hasAbstract = theAbstract !== undefined;
        const pdfLink = chooseCanonicalPdfLink(canonicalFields);
        const hasPdfLink = pdfLink !== undefined;
        prettyPrint({ canonicalFields, theAbstract, pdfLink });

        if (postResultsToOpenReview) {
          if (hasAbstract) {
            await this.shadow.updateFieldStatus(noteId, 'abstract', theAbstract);
          }
          if (hasPdfLink) {
            await this.shadow.updateFieldStatus(noteId, 'pdf', pdfLink);
          }
          await this.updateWorkflowStatus(noteId, 'fields:posted');
        }

        await this.shadow.releaseSpiderableUrl(nextNoteCursor);
        await this.shadow.mdb.updateUrlStatus(noteId, {
          hasAbstract,
          hasPdfLink,
          httpStatus,
          response: responseUrl
        });
        return 'continue';
      },
      stopCondition
    ).finally(async () => {
      await browserPool.shutdown();
      await this.shadow.close();
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
  limit: number,
  postResultsToOpenReview: boolean
};


function chooseCanonicalAbstract(canonicalFields: CanonicalFieldRecords): string | undefined {
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

function chooseCanonicalPdfLink(canonicalFields: CanonicalFieldRecords): string | undefined {
  const pdfLinks = _.filter(canonicalFields.fields, (field) => field.name === 'pdf-link');
  if (pdfLinks.length > 0) {
    return pdfLinks[0].value;
  }
}
