import _ from 'lodash';
import * as E from 'fp-ts/Either';

import {
  CommLink,
  CustomHandler,
  defineSatelliteService,
  SatelliteService
} from '@watr/commlinks';

import {
  delay,
  getEnvMode,
  isTestingEnv,
  prettyFormat,
  prettyPrint,
  asyncDoUntil,
  asyncDoWhilst,
  asyncEachOfSeries,
  asyncEachSeries,
  putStrLn,
  isDevEnv,
  getServiceLogger,
  getCorpusRootDir
} from '@watr/commonlib';

import { AbstractFieldAttempts, CanonicalFieldRecords, extractFieldsForEntry, ExtractionErrors, ExtractionSharedEnv, getEnvCanonicalFields, initExtractionEnv, runFieldExtractor } from '@watr/field-extractors';

import { toUrl, URLRequest, validateUrl } from '../common/datatypes';

import { displayRestError, newOpenReviewExchange, Note, Notes, OpenReviewExchange } from '../common/openreview-exchange';
import { BrowserPool, initScraper, Scraper, UrlFetchData } from '@watr/spider';
import { SpiderService } from './spider-service';

import { HostStatus, NoteStatus, WorkflowStatus } from '~/db/schemas';
import { connectToMongoDB } from '~/db/mongodb';
import { formatStatusMessages, showStatusSummary } from '~/db/extraction-summary';
import { getNextSpiderableUrl, releaseSpiderableUrl, upsertHostStatus, upsertNoteStatus } from '~/db/query-api';
import { error } from 'console';
import { updateExternalModuleReference } from 'typescript';

interface NoteBatch {
  notes: Note[];
  initialOffset: number;
  finalOffset: number;
  availableNoteCount: number;
}

const log = getServiceLogger('OpenReviewRelay')


async function doUpdateNote(openReviewExchange: OpenReviewExchange, note: Note, abs: string, retries: number = 0): Promise<void> {
  const noteUpdate = {
    referent: note.id,
    content: {
      'abstract': abs
    },
    invitation: 'dblp.org/-/abstract',
    readers: ['everyone'],
    writers: [],
    signatures: ['dblp.org']
  }
  log.info(`POSTing updated note ${note.id}`);
  await openReviewExchange.getCredentials()
  await openReviewExchange.configAxios()
    .post("/notes", noteUpdate)
    .then(r => {
      const updatedNote: Note = r.data;
      log.info(`updated Note ${note.id}; updateId: ${updatedNote.id}`)
    })
    .catch(error => {
      displayRestError(error);
      return undefined;
    })
}

async function doFetchNotes(openReviewExchange: OpenReviewExchange, offset: number): Promise<Notes | undefined> {
  return openReviewExchange.apiGET<Notes>('/notes', { invitation: 'dblp.org/-/record', sort: 'number:desc', offset });
}

// async function doRunRelay(offset: number = 0, batchSize: number = 200): Promise<void> {
//   log.info(`Running Openreview -> abstract finder; mode=${getEnvMode()}`)

//   let nextOffset = offset;
//   const iterations = isTestingEnv() ? 2 : 0;
//   let iteration = 0;
//   const runForever = iterations === 0;

//   async function run(): Promise<boolean> {
//     iteration += 1;
//     log.info(`Running batch #${iteration}`)
//     if (!runForever && iteration >= iterations) {
//       log.info(`Finished after specified ${iteration} batches`);
//       return false;
//     }
//     const noteBatch = await createNoteBatch(nextOffset, batchSize);

//     let { notes, finalOffset } = noteBatch;
//     if (notes.length === 0) {
//       log.info(`No more notes to process`);
//       return false;
//     }
//     nextOffset = finalOffset;

//     if (isTestingEnv() || isDevEnv()) {
//       const someNotes = notes.slice(0, 2);
//       notes = someNotes;
//     }

//     const maxRate = 5 * 1000;// 5 second max spidering rate

//     let currTime = Date.now();

//     await asyncEachOfSeries(notes, async (note: Note) => {
//       const elapsed = Date.now() - currTime;
//       const waitTime = maxRate - elapsed;

//       if (waitTime > 0) {
//         log.info(`Delaying ${waitTime / 1000} seconds...`);
//         await delay(waitTime);
//       }
//       currTime = Date.now();
//       const maybeAbs = await attemptExtractNote(note); //, byHostSuccFailSkipCounts, byHostErrors);
//       if (maybeAbs === undefined) {
//         return;
//       }
//       await doUpdateNote(note, maybeAbs);
//     });

//     // prettyPrint({ byHostSuccFailSkipCounts, byHostErrors });

//     const summaryMessages = await showStatusSummary();
//     const formatted = formatStatusMessages(summaryMessages);
//     putStrLn(formatted);

//     return true;
//   }

//   await asyncDoWhilst(
//     run,
//     async (shouldContinue: boolean) => shouldContinue
//   );
// }

// async function attemptExtractNote(note: Note,): Promise<string | undefined> {
//   log.debug(`attemptExtractNote(${note.id}, ${note.content.html})`);


//   const contentHtml = note.content['html'];
//   const maybeUrl = validateUrl(contentHtml);

//   if (E.isLeft(maybeUrl)) {
//     return undefined;
//   }

//   const url = maybeUrl.right;
//   const urlAsString = url.toString();


//   const res: CanonicalFieldRecords | ExtractionErrors = await runOneURL(URLRequest(urlAsString));

//   const pfres = prettyFormat(res)
//   log.debug(`runOneURL() => ${pfres}`);


//   if ('errors' in res) {
//     return;
//   }

//   const abstracts = res.fields.filter((rec) => {
//     return rec.name === 'abstract';
//   });

//   const abstractsClipped = res.fields.filter((rec) => {
//     return rec.name === 'abstract-clipped'
//   });

//   const hasAbstract = abstracts.length > 0 || abstractsClipped.length > 0;

//   await HostStatus.findOneAndUpdate({
//     noteId: note.id
//   }, {
//     hasAbstract
//   });


//   if (!hasAbstract) {
//     // errors.add('no abstract found');
//     // byHostSuccFailSkipCounts[adjustedHostname] = [prevSucc, prevFail + 1, prevSkip];
//     return;
//   }

//   // byHostSuccFailSkipCounts[adjustedHostname] = [prevSucc + 1, prevFail, prevSkip];
//   const abstrct = abstracts[0] || abstractsClipped[0];

//   return abstrct.value;
// }

// async function createNoteBatch(_offset: number, batchSize: number): Promise<NoteBatch> {
//   let offset = _offset;

//   const notesWithUrlNoAbs: Note[] = [];
//   log.info(`CreateNoteBatch: offset: ${offset}, batchSize: ${batchSize} ...`)
//   let availableNoteCount = 0;

//   await asyncDoUntil(
//     async function (): Promise<number> {
//       try {
//         const nextNotes = await doFetchNotes(offset);
//         if (nextNotes === undefined) {
//           return Promise.reject(new Error('doFetchNotes() return undefined'));
//         }

//         const { notes, count } = nextNotes;

//         if (notes.length === 0) return 0;

//         log.info(`fetched ${notes.length} (of ${count}) notes`)

//         availableNoteCount = count;
//         offset += notes.length;


//         await asyncEachSeries(notes, async (note: Note) => {
//           const { content } = note;
//           const abs = content.abstract;
//           const { html } = content;
//           const hasAbstract = abs !== undefined;
//           const noteStatus = await upsertNoteStatus({ noteId: note.id, urlstr: html })
//           if (!noteStatus.validUrl) {
//             return;
//           }
//           const requestUrl = noteStatus.url;
//           if (requestUrl === undefined) {
//             return Promise.reject(`Invalid state: NoteStatus(${note.id}).validUrl===true, url===undefined`);
//           }
//           const hostStatus = await upsertHostStatus(note.id, { hasAbstract, requestUrl })

//           // if (html === undefined) {
//           //   notesWithoutUrls.push(note);
//           //   return;
//           // }
//           if (abs === undefined) {
//             notesWithUrlNoAbs.push(note);
//             return;
//           }
//           // notesWithAbstracts.push(note);
//         });
//         return notes.length;
//       } catch (error) {
//         return Promise.reject(error);
//       }
//     },
//     async function test(fetchLength: number): Promise<boolean> {
//       const atBatchLimit = notesWithUrlNoAbs.length >= batchSize;
//       const doneFetching = fetchLength === 0;
//       log.info(`CreateBatch: until fetchLength(=${fetchLength})===0 || processableNotes(=${notesWithUrlNoAbs.length}) >= batchLimit(=${batchSize})`)
//       return doneFetching || atBatchLimit;
//     }
//   );

//   const noteBatch: NoteBatch = {
//     notes: notesWithUrlNoAbs,
//     initialOffset: _offset,
//     finalOffset: offset,
//     availableNoteCount,
//   }

//   return noteBatch;
// }

// async function runOneURL(arg: URLRequest): Promise<CanonicalFieldRecords | ExtractionErrors> {
//   const { url } = arg;

//   log.info(`Fetching fields for ${url}`);
//   const urlFetchData: UrlFetchData | undefined =
//     await this.commLink.call('scrapeAndExtract', url, { to: SpiderService.name });

//   if (urlFetchData === undefined) {
//     await HostStatus.findOneAndUpdate({
//       requestUrl: url
//     }, {
//       validResponseUrl: false,
//       response: 'Spider failed'
//     });

//     return ExtractionErrors(`spider did not successfully scrape url ${url}`, { url });
//   }


//   const finalUrl = urlFetchData.responseUrl;
//   const fieldRecs = getCanonicalFieldRecsForURL(url);
//   const maybeFinalUrl = validateUrl(finalUrl);

//   const validResponseUrl = E.isRight(maybeFinalUrl);
//   const responseHost = validResponseUrl ? maybeFinalUrl.right.hostname : undefined;

//   await HostStatus.findOneAndUpdate({
//     requestUrl: url
//   }, {
//     validResponseUrl,
//     response: finalUrl,
//     responseHost,
//     httpStatus: urlFetchData.status
//   });

//   if (fieldRecs === undefined) {
//     const msg = 'No extracted fields available';
//     log.info(msg);
//     return ExtractionErrors(msg, { url });
//   }
//   fieldRecs.finalUrl = finalUrl;

//   return fieldRecs;
// }


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




export async function runRelayExtract(count: number) {
  let currCount = 0;

  const corpusRoot = getCorpusRootDir();

  const scraper = await initScraper({ corpusRoot });
  const { browserPool } = scraper;
  return asyncDoUntil(
    async () => {
      const nextSpiderable = await getNextSpiderableUrl();
      if (nextSpiderable === undefined) {
        log.info('runRelayExtract(): no more spiderable urls in mongo')
        return;
      }
      const noteId = nextSpiderable._id;
      currCount += 1;
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

      return releaseSpiderableUrl(nextSpiderable, 'extractor:success');

    },
    () => Promise.resolve(currCount >= count)
  )
}
