import _ from 'lodash';

import {
  getServiceLogger, putStrLn,
} from '@watr/commonlib';

import {
  OpenReviewGateway,
  Note,
} from './openreview-gateway';

import { Logger } from 'winston';
import { generateFromBatch } from '~/util/generators';
import { ShadowDB } from './shadow-db';


export class FetchService {
  log: Logger;
  gate: OpenReviewGateway;
  shadow: ShadowDB

  constructor() {
    this.log = getServiceLogger('FetchService');
    this.gate = new OpenReviewGateway();
    this.shadow = new ShadowDB();
  }

  async *createNoteBatchGenerator(startingNoteId?: string): AsyncGenerator<Note[], void, void> {
    let curNoteId = startingNoteId;
    while (true) {
      putStrLn(`generateNoteBatches(from=${curNoteId})`);
      const noteBatch = await this.gate.fetchNotes(curNoteId);
      if (noteBatch === undefined || noteBatch.notes.length === 0) {
        this.log.debug('Exhausted Openreview /notes');
        return;
      }
      this.log.debug(`Fetched ${noteBatch.notes.length} /notes after:${curNoteId} (of ${noteBatch.count} total)`);
      const endNote = noteBatch.notes[noteBatch.notes.length - 1];
      curNoteId = endNote.id;
      yield noteBatch.notes;
    }
  }

  createNoteGenerator(startingNoteId?: string, limit?: number): AsyncGenerator<Note, number, void> {
    return generateFromBatch<Note>(this.createNoteBatchGenerator(startingNoteId), limit? limit : 0);
  }

  async updateFetchCursor(noteId: string) {
    this.shadow.updateCursor('fetch-openreview-notes', noteId);
  }
  async getFetchCursor() {
    return await this.shadow.getCursor('fetch-openreview-notes');
  }

  async runFetchLoop(limit?: number) {
    this.log.info(`Starting Fetch Service`);
    const startingNote = await this.getFetchCursor()
    const startingNoteId = startingNote? startingNote.noteId : undefined;
    if (startingNoteId) {
      this.log.info(`Resuming Fetch Service from note ${startingNoteId}`);
    }

    const noteGenerator = this.createNoteGenerator(startingNoteId, limit);

    let cur = await noteGenerator.next();
    for (; !cur.done; cur = await noteGenerator.next()) {
      const note = cur.value;
      putStrLn(`Saving note ${note.id}`);
      await this.shadow.saveNote(note, true);
      this.updateFetchCursor(note.id);
    }
    putStrLn('FetchLoop complete');
  }
}
