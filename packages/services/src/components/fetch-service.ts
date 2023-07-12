import _ from 'lodash';

import {
  getServiceLogger, putStrLn,
} from '@watr/commonlib';

import {
  OpenReviewGateway,
  Note,
  NoteCursor,
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

  async *createNoteBatchGenerator(noteCursor?: NoteCursor): AsyncGenerator<Note[], void, void> {
    let curNoteCursor = noteCursor;
    while (true) {
      putStrLn(`generateNoteBatches(from=${curNoteCursor})`);
      const noteBatch = await this.gate.fetchNotes(curNoteCursor);
      if (noteBatch === undefined || noteBatch.notes.length === 0) {
        this.log.debug('Exhausted Openreview /notes');
        return;
      }
      this.log.debug(`Fetched ${noteBatch.notes.length} /notes after:${curNoteCursor} (of ${noteBatch.count} total)`);
      const endNote = noteBatch.notes[noteBatch.notes.length - 1];
      curNoteCursor = endNote.id;
      yield noteBatch.notes;
    }
  }

  createNoteGenerator(noteCursor?: NoteCursor, limit?: number): AsyncGenerator<Note, number, void> {
    return generateFromBatch<Note>(this.createNoteBatchGenerator(noteCursor), limit? limit : 0);
  }

  async runFetchLoop(fromCursor?: NoteCursor, limit?: number) {
    this.log.info(`Starting Fetch Service ${fromCursor? 'from cursor'+fromCursor: ''}`);

    const noteGenerator = this.createNoteGenerator(fromCursor, limit);

    let cur = await noteGenerator.next();
    for (; !cur.done; cur = await noteGenerator.next()) {
      putStrLn(`Saving note ${cur.value.id}`);
      await this.shadow.saveNoteToShadowDB(cur.value);
    }
    putStrLn('FetchLoop complete');
  }
}
