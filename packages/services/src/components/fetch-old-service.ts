import _ from 'lodash';

import {
  asyncEachSeries,
  getServiceLogger,
  delay,
  asyncForever
} from '@watr/commonlib';

import { Logger } from 'winston';
import { WorkflowStatus } from '~/db/schemas';

import {
  OpenReviewGateway,
  Note
} from './openreview-gateway';


const oneMinute = 60 * 1000;
const FetcherDelayTime = 5 * oneMinute;

export class FetchService {
  log: Logger;
  gate: OpenReviewGateway;

  constructor() {
    this.log = getServiceLogger('FetchService');
    this.gate = new OpenReviewGateway();
  }

  /**
   * Fetch Batches of notes from Openreview REST API, put them in local MongoDB
   * queue for spidering/extraction
   */
  // async runRelayFetch(_initOffset: number, numToFetch: number) {
  //   const self = this;
  //   let offset = _initOffset;
  //   const runForever = numToFetch === 0;
  //   // const openReviewExchange = newOpenReviewExchange(getServiceLogger('OpenReviewExchange'));

  //   this.log.info(`Relay Fetcher: offset: ${offset}, numToFetch: ${numToFetch} ...`);

  //   let numProcessed = 0;

  //   await asyncForever(
  //     async function (): Promise<void> {
  //       if (numProcessed >= numToFetch && !runForever) {
  //         self.log.info('Note Fetcher reached fetch limit, exiting');
  //         return Promise.reject(new Error('Note Limit Reached'));
  //       }
  //       try {
  //         const nextNotes = await self.gate.doFetchNotes(offset);
  //         if (nextNotes === undefined) {
  //           return Promise.reject(new Error('doFetchNotes() return undefined'));
  //         }

  //         const { notes, count } = nextNotes;
  //         const fetchLength = notes.length;

  //         if (fetchLength === 0) {
  //           self.log.info('Note Fetcher exhausted available notes. Pausing..');
  //           await delay(FetcherDelayTime);
  //           return;
  //         }

  //         self.log.info(`fetched ${notes.length} (of ${count}) notes`);

  //         offset += fetchLength;

  //         const noteSliceEndIndex = runForever ? fetchLength : numProcessed + numToFetch;
  //         const notesToProcess = notes.slice(0, noteSliceEndIndex);

  //         self.log.info(`Processing a batch of size ${notesToProcess.length}`);
  //         const addedNoteCount = await self._processNoteBatch(notesToProcess, true);
  //         self.log.info(`  ... added ${addedNoteCount} notes`);
  //         numProcessed += addedNoteCount;
  //         self.log.info(`Upserted (${numProcessed}/${count})`);
  //         if (addedNoteCount < notesToProcess.length) {
  //           self.log.info('Note Fetcher reached an already added note. Pausing..');
  //           await delay(FetcherDelayTime);
  //         }
  //       } catch (error) {
  //         return Promise.reject(error);
  //       }
  //     }
  //   ).catch(error => {
  //     self.log.error(`${error}`);
  //   });
  // }


  // async _processNoteBatch(notes: Note[], stopOnExistingNote: boolean): Promise<number> {
  //   let numProcessed = 0;
  //   let doneProcessing = false;

  //   await asyncEachSeries(notes, async (note: Note) => {
  //     if (doneProcessing) return;

  //     const urlstr = note.content.html;
  //     const existingNote = await findNoteStatusById(note.id);
  //     const noteExists = existingNote !== undefined;
  //     if (noteExists && stopOnExistingNote) {
  //       this.log.info('Found fetched note in local MongoDB; stopping fetcher');
  //       doneProcessing = true;
  //       return;
  //     }

  //     const noteStatus = await upsertNoteStatus({ noteId: note.id, urlstr });
  //     numProcessed += 1;
  //     if (!noteStatus.validUrl) {
  //       this.log.info(`NoteStatus: invalid url '${urlstr}'`);
  //       return;
  //     }
  //     const requestUrl = noteStatus.url;
  //     if (requestUrl === undefined) {
  //       return Promise.reject(`Invalid state: NoteStatus(${note.id}).validUrl===true, url===undefined`);
  //     }

  //     const abs = note.content.abstract;
  //     const pdfLink = note.content.pdf;
  //     const hasAbstract = typeof abs === 'string';
  //     const hasPdfLink = typeof pdfLink === 'string';
  //     const status: WorkflowStatus = hasAbstract && hasPdfLink ? 'extractor:success' : 'available';
  //     await upsertUrlStatus(note.id, status, { hasAbstract, hasPdfLink, requestUrl });
  //   });

  //   return numProcessed;
  // }
}
