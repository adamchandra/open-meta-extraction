
import _ from 'lodash';

import {
  asyncEachSeries,
  getServiceLogger,
  delay,
  asyncForever,
  asyncDoWhilst
} from '@watr/commonlib';

import { WorkflowStatus } from '~/db/schemas';

import {
  findNoteStatusById,
  upsertHostStatus,
  upsertNoteStatus
} from '~/db/query-api';

import {
  OpenReviewGateway,
  Note,
  Notes
} from './openreview-gateway';

import { Logger } from 'winston';
import { generateFromBatch } from '~/util/generators';

const oneMinute = 60 * 1000;
const FetcherDelayTime = 5 * oneMinute;

export class FetchService {
  log: Logger;
  gate: OpenReviewGateway;

  constructor() {
    this.log = getServiceLogger('FetchService');
    this.gate = new OpenReviewGateway();
  }


  async fetchNoteBatch(afterNoteId?: string, limit?: number): Promise<Notes> {
    const self = this;
    const noteBatch = await self.gate.fetchNotes(afterNoteId);
    if (noteBatch === undefined) {
      return Promise.reject(new Error('doFetchNotes() return undefined'));
    }
    const { notes, count } = noteBatch;
    const fetchLength = notes.length;
    if (limit) {
      noteBatch.notes = notes.slice(0, limit);
    }

    self.log.debug(`Fetched ${fetchLength} ${limit ? '(limit=' + limit + ')' : ''} notes ${notes.length} (of ${count}) notes`);

    return noteBatch;
  }
  /**
   * Fetch Batches of notes from Openreview REST API, put them in local MongoDB
   * queue for spidering/extraction
   * limit == 0 runs forever
   */
  async runRelayFetch(limit: number) { // TODO rename -> *NewestFirst
    // store afternote in db? or local variable
    const self = this;
    const runForever = limit === 0;
    // const openReviewExchange = newOpenReviewExchange(getServiceLogger('OpenReviewExchange'));

    this.log.info(`Starting Fetch Service`);

    let numProcessed = 0;
    // TODO remove
    let offset = -1
    let numToFetch = -1

    await asyncForever(
      async function (): Promise<void> {
        if (numProcessed >= limit && !runForever) {
          self.log.info('Note Fetcher reached fetch limit, exiting');
          return Promise.reject(new Error('Note Limit Reached'));
        }
        try {
          const nextNotes = await self.fetchNoteBatch();

          const { notes, count } = nextNotes;
          const fetchLength = notes.length;

          if (fetchLength === 0) {
            self.log.info('Note Fetcher exhausted available notes. Pausing..');
            await delay(FetcherDelayTime);
            return;
          }

          self.log.info(`fetched ${notes.length} (of ${count}) notes`);

          offset += fetchLength;

          const noteSliceEndIndex = runForever ? fetchLength : numProcessed + numToFetch;
          const notesToProcess = notes.slice(0, noteSliceEndIndex);

          self.log.info(`Processing a batch of size ${notesToProcess.length}`);
          const addedNoteCount = await self._processNoteBatch(notesToProcess, true);
          self.log.info(`  ... added ${addedNoteCount} notes`);
          numProcessed += addedNoteCount;
          self.log.info(`Upserted (${numProcessed}/${count})`);
          if (addedNoteCount < notesToProcess.length) {
            self.log.info('Note Fetcher reached an already added note. Pausing..');
            await delay(FetcherDelayTime);
          }
        } catch (error) {
          return Promise.reject(error);
        }
      }
    ).catch(error => {
      self.log.error(`${error}`);
    });
  }

  async *generateNoteBatches(noteCursor: string): AsyncGenerator<Note[], void, void> {
    while (true) {
      const nextNotes = await this.fetchNoteBatch(noteCursor);
      yield nextNotes.notes;
    }
  }

  generateNotes(noteCursor: string, limit: number): AsyncGenerator<Note, number, void> {
    return generateFromBatch<Note>(this.generateNoteBatches(noteCursor), limit);
  }

  async runRelayFetchOldestFirst(limit: number) {
    this.log.info(`Starting Fetch Service, oldest first`);
    let rearNoteCursor = 'someNoteid'; // fetch from db

    const noteGenerator = this.generateNotes(rearNoteCursor, limit);

    let cur = await noteGenerator.next();
    for (; !cur.done; cur = await noteGenerator.next()) {
      await this.saveNoteToShadowDB(cur.value);
    }
  }


  async saveNoteToShadowDB(note: Note): Promise<void> {
    const urlstr = note.content.html;
    const existingNote = await findNoteStatusById(note.id);
    const noteExists = existingNote !== undefined;
    if (noteExists) {
      this.log.info('Found fetched note in local MongoDB; stopping fetcher');
      return;
    }

    const noteStatus = await upsertNoteStatus({ noteId: note.id, urlstr });
    if (!noteStatus.validUrl) {
      this.log.info(`NoteStatus: invalid url '${urlstr}'`);
      return;
    }
    const requestUrl = noteStatus.url;
    if (requestUrl === undefined) {
      return Promise.reject(`Invalid state: NoteStatus(${note.id}).validUrl===true, url===undefined`);
    }

    const abs = note.content.abstract;
    const pdfLink = note.content.pdf;
    const hasAbstract = typeof abs === 'string';
    const hasPdfLink = typeof pdfLink === 'string';
    const status: WorkflowStatus = hasAbstract && hasPdfLink ? 'extractor:success' : 'available';
    await upsertHostStatus(note.id, status, { hasAbstract, hasPdfLink, requestUrl });
  }

  async _processNoteBatch(notes: Note[], stopOnExistingNote: boolean): Promise<number> {
    let numProcessed = 0;
    let doneProcessing = false;

    await asyncEachSeries(notes, async (note: Note) => {
      if (doneProcessing) return;

      /// saveNoteToShadowDB
      const urlstr = note.content.html;
      const existingNote = await findNoteStatusById(note.id);
      const noteExists = existingNote !== undefined;
      if (noteExists && stopOnExistingNote) {
        this.log.info('Found fetched note in local MongoDB; stopping fetcher');
        doneProcessing = true;
        return;
      }

      const noteStatus = await upsertNoteStatus({ noteId: note.id, urlstr });
      numProcessed += 1;
      if (!noteStatus.validUrl) {
        this.log.info(`NoteStatus: invalid url '${urlstr}'`);
        return;
      }
      const requestUrl = noteStatus.url;
      if (requestUrl === undefined) {
        return Promise.reject(`Invalid state: NoteStatus(${note.id}).validUrl===true, url===undefined`);
      }

      const abs = note.content.abstract;
      const pdfLink = note.content.pdf;
      const hasAbstract = typeof abs === 'string';
      const hasPdfLink = typeof pdfLink === 'string';
      const status: WorkflowStatus = hasAbstract && hasPdfLink ? 'extractor:success' : 'available';
      await upsertHostStatus(note.id, status, { hasAbstract, hasPdfLink, requestUrl });
    });

    return numProcessed;
  }
}

// TODO delete
    // async function continueTest(): Promise<boolean> {
    //   // Assume rear/front cursors exist
    //   const cursorExhausted = true; // rearNoteCursor.number < frontNoteCursor.number
    //   const notAtLimit = numProcessed < limit || runForever;

    //   return true;
    // }

    // async function fetchFunction(): Promise<void> {
    //   if (currentNoteBatch.length === 0) {
    //     const nextNotes = await self.fetchNoteBatch(rearNoteCursor);
    //     currentNoteBatch = nextNotes.notes;
    //   }

    //   // const { notes, count } = nextNotes;
    //   const fetchLength = currentNoteBatch.length;

    //   if (fetchLength === 0) {
    //     self.log.info('Note Fetcher exhausted available notes. Pausing..');
    //     return;
    //   }
    // }


    // await asyncDoWhilst(fetchFunction, continueTest);
