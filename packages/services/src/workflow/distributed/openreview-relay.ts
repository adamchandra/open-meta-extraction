import _ from 'lodash';
import * as E from 'fp-ts/Either';
import { differenceInMilliseconds } from 'date-fns';

import {
  prettyPrint,
  asyncDoUntil,
  asyncEachSeries,
  getServiceLogger,
  getCorpusRootDir,
  delay
} from '@watr/commonlib';

import { AbstractFieldAttempts, ExtractionSharedEnv, getEnvCanonicalFields, initExtractionEnv, runFieldExtractor } from '@watr/field-extractors';

import { initScraper } from '@watr/spider';
import { displayRestError, newOpenReviewExchange, Note, Notes, OpenReviewExchange } from '../common/openreview-exchange';

import { WorkflowStatus } from '~/db/schemas';
import { getNextSpiderableUrl, releaseSpiderableUrl, upsertHostStatus, upsertNoteStatus } from '~/db/query-api';

const log = getServiceLogger('OpenReviewRelay');

async function doUpdateNote(openReviewExchange: OpenReviewExchange, noteId: string, abs: string): Promise<void> {
  const noteUpdate = {
    referent: noteId,
    content: {
      'abstract': abs
    },
    invitation: 'dblp.org/-/abstract',
    readers: ['everyone'],
    writers: [],
    signatures: ['dblp.org']
  }
  log.info(`POSTing updated note ${noteId}`);
  await openReviewExchange.getCredentials()
  await openReviewExchange.configAxios()
    .post("/notes", noteUpdate)
    .then(r => {
      const updatedNote: Note = r.data;
      log.info(`updated Note ${noteId}; updateId: ${updatedNote.id}`)
    })
    .catch(error => {
      displayRestError(error);
      return undefined;
    })
}

async function doFetchNotes(openReviewExchange: OpenReviewExchange, offset: number): Promise<Notes | undefined> {
  return openReviewExchange.apiGET<Notes>('/notes', { invitation: 'dblp.org/-/record', sort: 'number:desc', offset });
}

/** Fetch Batches of notes from Openreview REST API, put them in
 * local MongoDB queue for spidering/extraction
 */
export async function runRelayFetch(_offset: number, count: number) {
  let offset = _offset;
  const openReviewExchange = newOpenReviewExchange(getServiceLogger("OpenReviewExchange"));

  log.info(`Relay Fetcher: offset: ${offset}, count: ${count} ...`)
  let numProcessed = 0;

  async function stopCondition(fetchLength: number): Promise<boolean> {
    const atCountLimit = numProcessed >= count;
    const doneFetching = fetchLength === 0;
    return doneFetching || atCountLimit;
  }

  await asyncDoUntil(
    async function (): Promise<number> {
      try {
        const nextNotes = await doFetchNotes(openReviewExchange, offset);
        if (nextNotes === undefined) {
          return Promise.reject(new Error('doFetchNotes() return undefined'));
        }

        const { notes, count } = nextNotes;

        const fetchLength = nextNotes.notes.length;
        if (fetchLength === 0) return 0;

        log.info(`fetched ${notes.length} (of ${count}) notes`)

        offset += fetchLength;

        await asyncEachSeries(notes, async (note: Note) => {
          const shouldStop = await stopCondition(fetchLength);
          if (shouldStop) return 0;
          // prettyPrint({ note })

          const urlstr = note.content.html;

          const noteStatus = await upsertNoteStatus({ noteId: note.id, urlstr })
          numProcessed += 1;
          if (!noteStatus.validUrl) {
            log.info(`NoteStatus: invalid url '${urlstr}'`)
            return;
          }
          const requestUrl = noteStatus.url;
          if (requestUrl === undefined) {
            return Promise.reject(`Invalid state: NoteStatus(${note.id}).validUrl===true, url===undefined`);
          }

          const abs = note.content.abstract;
          const hasAbstract = typeof abs === 'string';
          const status: WorkflowStatus = hasAbstract ? 'extractor:success' : 'available';
          const upserted = await upsertHostStatus(note.id, status, { hasAbstract, requestUrl })
          log.info(`Upsert (${numProcessed}/${count}) ${upserted._id}; ${upserted.requestUrl}`)
        });
        return fetchLength;
      } catch (error) {
        return Promise.reject(error);
      }
    },
    stopCondition
  ).catch(error => {
    log.error(`${error}`)
  });
}


async function rateLimit(prevTime: Date, maxRateMs: number): Promise<Date> {
  const currTime = new Date();
  const elapsedMs = differenceInMilliseconds(currTime, prevTime)
  const waitTime = maxRateMs - elapsedMs;

  if (waitTime > 0) {
    log.info(`Delaying ${waitTime / 1000} seconds...`);
    await delay(waitTime);
  }
  return currTime;
}


export async function runRelayExtract(count: number) {
  let currCount = 0;
  const runForever = count === 0;

  const corpusRoot = getCorpusRootDir();
  const openReviewExchange = newOpenReviewExchange(getServiceLogger("OpenReviewExchange"));

  const scraper = await initScraper({ corpusRoot });
  const { browserPool } = scraper;

  const maxRate = 5 * 1000;// 5 second max spidering rate
  let currTime = new Date();

  async function stopCondition(): Promise<boolean> {
    const atCountLimit = currCount >= count;
    currTime = await rateLimit(currTime, maxRate);
    return atCountLimit && !runForever;
  }

  return asyncDoUntil(
    async () => {
      const nextSpiderable = await getNextSpiderableUrl();

      if (nextSpiderable === undefined) {
        log.info('runRelayExtract(): no more spiderable urls in mongo')
        return;
      }

      currCount += 1;

      const noteId = nextSpiderable._id;
      const url = nextSpiderable.requestUrl

      const scrapedUrl = await scraper.scrapeUrl(url, true);

      if (E.isLeft(scrapedUrl)) {
        return releaseSpiderableUrl(nextSpiderable, 'spider:fail');
      }

      log.info('Field Extraction starting..')
      const urlFetchData = scrapedUrl.right;
      const { status, responseUrl } = urlFetchData;

      let httpStatus = 0;
      try { httpStatus = Number.parseInt(status); } catch { }

      await upsertHostStatus(noteId, 'extractor:locked', {
        httpStatus,
        response: responseUrl
      });
      const sharedEnv: ExtractionSharedEnv = {
        log,
        browserPool,
        urlFetchData
      };

      const entryPath = scraper.getUrlCorpusEntryPath(url);
      const exEnv = await initExtractionEnv(entryPath, sharedEnv);
      const fieldExtractionResults = await runFieldExtractor(exEnv, AbstractFieldAttempts);

      if (E.isLeft(fieldExtractionResults)) {
        return releaseSpiderableUrl(nextSpiderable, 'extractor:fail');
      }

      const [, extractionEnv] = fieldExtractionResults.right;

      const canonicalFields = getEnvCanonicalFields(extractionEnv);

      prettyPrint({ canonicalFields })
      const abstracts = _.filter(canonicalFields.fields, (field) => field.name === 'abstract');
      const clippedAbstracts = _.filter(canonicalFields.fields, (field) => field.name === 'abstract-clipped');
      let theAbstract: string | undefined;
      if (abstracts.length > 0) {
        theAbstract = abstracts[0].value;
      } else if (clippedAbstracts.length > 0) {
        theAbstract = clippedAbstracts[0].value;
      }

      const hasAbstract = theAbstract !== undefined;

      if (theAbstract !== undefined) {
        await doUpdateNote(openReviewExchange, noteId, theAbstract);
      }

      await upsertHostStatus(noteId, 'extractor:success', {
        hasAbstract,
      });
    },
    stopCondition
  ).finally(() => {
    return browserPool.shutdown();
  })
}
