import _ from 'lodash';
import { Logger } from 'winston';
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
  isDevEnv
} from '@watr/commonlib';

import { CanonicalFieldRecords, ExtractionErrors } from '@watr/field-extractors';

import { toUrl, URLRequest, validateUrl } from '../common/datatypes';

import { displayRestError, newOpenReviewExchange, Note, Notes, OpenReviewExchange } from '../common/openreview-exchange';
import { UrlFetchData } from '@watr/spider';
import { SpiderService } from './spider-service';
import { getCanonicalFieldRecsForURL } from '../common/utils';
import { HostStatus, NoteStatus } from '~/db/schemas';
import { connectToMongoDB } from '~/db/mongodb';
import { formatStatusMessages, showStatusSummary } from '~/db/extraction-summary';
import { upsertHostStatus, upsertNoteStatus } from '~/db/query-api';

interface NoteBatch {
  notes: Note[];
  initialOffset: number;
  finalOffset: number;
  availableNoteCount: number;
}


interface OpenReviewRelay {
  openReviewExchange: OpenReviewExchange;

  commLink: CommLink<SatelliteService<OpenReviewRelay>>;
  log: Logger;
  networkReady: CustomHandler<OpenReviewRelay, unknown, unknown>;
  startup: CustomHandler<OpenReviewRelay, unknown, unknown>;
  shutdown: CustomHandler<OpenReviewRelay, unknown, unknown>;

  doUpdateNote(note: Note, abs: string, retries?: number): Promise<void>;
  doFetchNotes(offset: number): Promise<Notes | undefined>;
  doRunRelay(offset?: number, batchSize?: number): Promise<void>;
  runOneURL(arg: URLRequest): Promise<CanonicalFieldRecords | ExtractionErrors>;
  attemptExtractNote(note: Note): Promise<string | undefined>;

  createNoteBatch(_offset: number, batchSize: number): Promise<NoteBatch>;
}


export const OpenReviewRelayService = defineSatelliteService<OpenReviewRelay>(
  'OpenReviewRelayService',
  async (commLink) => {
    const relay = newOpenReviewRelay(commLink);
    return relay;
  });


function newOpenReviewRelay(
  commLink: CommLink<SatelliteService<OpenReviewRelay>>,
) {

  const relay: OpenReviewRelay = {
    openReviewExchange: newOpenReviewExchange(commLink.log),
    commLink,
    log: commLink.log,
    async networkReady() {
      console.log('inside OpenReviewRelay networkReady')

      await this.openReviewExchange
        .getCredentials()
        .catch(error => {
          this.log.error(`Error: ${error}`);
        });
    },
    async startup() {
      this.commLink.log.info('relay startup');
      const mongoose = await connectToMongoDB();
      this.log.info(`Successful connection to MongoDB`);
      await this
        .doRunRelay()
        .catch(error => {
          this.log.warn(`Error: ${error}`);
        }).finally(async () => {
          await mongoose.connection.close();
        });
    },
    async shutdown() {
    },


    async doUpdateNote(note: Note, abs: string, retries: number = 0): Promise<void> {
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
      this.log.info(`POSTing updated note ${note.id}`);
      await this.openReviewExchange.getCredentials()
      await this.openReviewExchange.configAxios()
        .post("/notes", noteUpdate)
        .then(r => {
          const updatedNote: Note = r.data;
          this.log.info(`updated Note ${note.id}; updateId: ${updatedNote.id}`)
        })
        .catch(error => {
          displayRestError(error);
          this.commLink.log.warn(`doUpdateNote ${note.id}: retries=${retries} `)
          if (retries > 1) {
            return undefined;
          }
          this.doUpdateNote(note, abs, retries + 1);
        })
    },

    async doFetchNotes(offset: number): Promise<Notes | undefined> {
      return this.openReviewExchange.apiGET<Notes>('/notes', { invitation: 'dblp.org/-/record', sort: 'number:desc', offset })
    },

    async doRunRelay(offset: number = 0, batchSize: number = 200): Promise<void> {
      this.log.info(`Running Openreview -> abstract finder; mode=${getEnvMode()}`)
      const self = this;

      let nextOffset = offset;
      const iterations = isTestingEnv() ? 2 : 0;
      let iteration = 0;
      const runForever = iterations === 0;

      async function run(): Promise<boolean> {
        iteration += 1;
        self.log.info(`Running batch #${iteration}`)
        if (!runForever && iteration >= iterations) {
          self.log.info(`Finished after specified ${iteration} batches`);
          return false;
        }
        const noteBatch = await self.createNoteBatch(nextOffset, batchSize);

        let { notes, finalOffset } = noteBatch;
        if (notes.length === 0) {
          self.log.info(`No more notes to process`);
          return false;
        }
        nextOffset = finalOffset;

        if (isTestingEnv() || isDevEnv()) {
          const someNotes = notes.slice(0, 2);
          notes = someNotes;
        }

        const maxRate = 5 * 1000;// 5 second max spidering rate

        let currTime = Date.now();

        await asyncEachOfSeries(notes, async (note: Note) => {
          const elapsed = Date.now() - currTime;
          const waitTime = maxRate - elapsed;

          if (waitTime > 0) {
            self.log.info(`Delaying ${waitTime / 1000} seconds...`);
            await delay(waitTime);
          }
          currTime = Date.now();
          const maybeAbs = await self.attemptExtractNote(note); //, byHostSuccFailSkipCounts, byHostErrors);
          if (maybeAbs === undefined) {
            return;
          }
          await self.doUpdateNote(note, maybeAbs);
        });

        // prettyPrint({ byHostSuccFailSkipCounts, byHostErrors });

        const summaryMessages = await showStatusSummary();
        const formatted = formatStatusMessages(summaryMessages);
        putStrLn(formatted);

        return true;
      }

      await asyncDoWhilst(
        run,
        async (shouldContinue: boolean) => shouldContinue
      );
    },

    async attemptExtractNote(
      note: Note,
    ): Promise<string | undefined> {
      this.commLink.log.debug(`attemptExtractNote(${note.id}, ${note.content.html})`);


      const contentHtml = note.content['html'];
      const maybeUrl = validateUrl(contentHtml);

      if (E.isLeft(maybeUrl)) {
        return undefined;
      }

      const url = maybeUrl.right;
      const urlAsString = url.toString();


      const res: CanonicalFieldRecords | ExtractionErrors = await this.runOneURL(URLRequest(urlAsString));

      const pfres = prettyFormat(res)
      this.commLink.log.debug(`runOneURL() => ${pfres}`);


      if ('errors' in res) {
        return;
      }

      const abstracts = res.fields.filter((rec) => {
        return rec.name === 'abstract';
      });

      const abstractsClipped = res.fields.filter((rec) => {
        return rec.name === 'abstract-clipped'
      });

      const hasAbstract = abstracts.length > 0 || abstractsClipped.length > 0;

      await HostStatus.findOneAndUpdate({
        noteId: note.id
      }, {
        hasAbstract
      });


      if (!hasAbstract) {
        // errors.add('no abstract found');
        // byHostSuccFailSkipCounts[adjustedHostname] = [prevSucc, prevFail + 1, prevSkip];
        return;
      }

      // byHostSuccFailSkipCounts[adjustedHostname] = [prevSucc + 1, prevFail, prevSkip];
      const abstrct = abstracts[0] || abstractsClipped[0];

      return abstrct.value;
    },

    async createNoteBatch(_offset: number, batchSize: number): Promise<NoteBatch> {
      const log = this.commLink.log;
      let offset = _offset;
      const self = this;

      const notesWithUrlNoAbs: Note[] = [];
      log.info(`CreateNoteBatch: offset: ${offset}, batchSize: ${batchSize} ...`)
      let availableNoteCount = 0;

      await asyncDoUntil(
        async function (): Promise<number> {
          try {
            const nextNotes = await self.doFetchNotes(offset);
            if (nextNotes === undefined) {
              return Promise.reject(new Error('doFetchNotes() return undefined'));
            }

            const { notes, count } = nextNotes;

            if (notes.length === 0) return 0;

            log.info(`fetched ${notes.length} (of ${count}) notes`)

            availableNoteCount = count;
            offset += notes.length;


            await asyncEachSeries(notes, async (note: Note) => {
              const { content } = note;
              const abs = content.abstract;
              const { html } = content;
              const hasAbstract = abs !== undefined;
              const noteStatus = await upsertNoteStatus({ noteId: note.id, urlstr: html })
              if (!noteStatus.validUrl) {
                return;
              }
              const requestUrl = noteStatus.url;
              if (requestUrl === undefined) {
                return Promise.reject(`Invalid state: NoteStatus(${note.id}).validUrl===true, url===undefined`);
              }
              const hostStatus = await upsertHostStatus(note.id, { hasAbstract, requestUrl })

              // if (html === undefined) {
              //   notesWithoutUrls.push(note);
              //   return;
              // }
              if (abs === undefined) {
                notesWithUrlNoAbs.push(note);
                return;
              }
              // notesWithAbstracts.push(note);
            });
            return notes.length;
          } catch (error) {
            return Promise.reject(error);
          }
        },
        async function test(fetchLength: number): Promise<boolean> {
          const atBatchLimit = notesWithUrlNoAbs.length >= batchSize;
          const doneFetching = fetchLength === 0;
          log.info(`CreateBatch: until fetchLength(=${fetchLength})===0 || processableNotes(=${notesWithUrlNoAbs.length}) >= batchLimit(=${batchSize})`)
          return doneFetching || atBatchLimit;
        }
      );

      const noteBatch: NoteBatch = {
        notes: notesWithUrlNoAbs,
        initialOffset: _offset,
        finalOffset: offset,
        availableNoteCount,
      }

      return noteBatch;
    },

    async runOneURL(arg: URLRequest): Promise<CanonicalFieldRecords | ExtractionErrors> {
      const { url } = arg;

      this.log.info(`Fetching fields for ${url}`);
      const urlFetchData: UrlFetchData | undefined =
        await this.commLink.call('scrapeAndExtract', url, { to: SpiderService.name });

      if (urlFetchData === undefined) {
        await HostStatus.findOneAndUpdate({
          requestUrl: url
        }, {
          validResponseUrl: false,
          response: 'Spider failed'
        });

        return ExtractionErrors(`spider did not successfully scrape url ${url}`, { url });
      }


      const finalUrl = urlFetchData.responseUrl;
      const fieldRecs = getCanonicalFieldRecsForURL(url);
      const maybeFinalUrl = validateUrl(finalUrl);

      const validResponseUrl = E.isRight(maybeFinalUrl);
      const responseHost = validResponseUrl ? maybeFinalUrl.right.hostname : undefined;

      await HostStatus.findOneAndUpdate({
        requestUrl: url
      }, {
        validResponseUrl,
        response: finalUrl,
        responseHost,
        httpStatus: urlFetchData.status
      });

      if (fieldRecs === undefined) {
        const msg = 'No extracted fields available';
        this.log.info(msg);
        return ExtractionErrors(msg, { url });
      }
      fieldRecs.finalUrl = finalUrl;

      return fieldRecs;
    },

  };
  return relay;
}

/*
 * Fetch Batches of notes from Openreview REST API, put them in
 * local MongoDB queue for spidering/extraction
 */
export async function runOpenReviewRelay() {

}
