import _ from 'lodash';

import {
  getServiceLogger,
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
  NoteCursor,
} from './openreview-gateway';

import { Logger } from 'winston';
import { generateFromBatch } from '~/util/generators';



export class FetchService {
  log: Logger;
  gate: OpenReviewGateway;

  constructor() {
    this.log = getServiceLogger('FetchService');
    this.gate = new OpenReviewGateway();
  }

  async *generateNoteBatches(noteCursor?: NoteCursor): AsyncGenerator<Note[], void, void> {
    while (true) {
      const noteBatch = await this.gate.fetchNotes(noteCursor);
      if (noteBatch === undefined) {
        this.log.debug('Exhausted Openreview /notes');
        return;
      }
      this.log.debug(`Fetched ${noteBatch.notes.length} /notes after:${noteCursor} (of ${noteBatch.count} total)`);
      yield noteBatch.notes;
    }
  }

  generateNotes(noteCursor?: NoteCursor, limit?: number): AsyncGenerator<Note, number, void> {
    return generateFromBatch<Note>(this.generateNoteBatches(noteCursor), limit? limit : 0);
  }

  async runFetchLoop(fromCursor?: NoteCursor, limit?: number) {
    this.log.info(`Starting Fetch Service ${fromCursor? 'from cursor'+fromCursor: ''}`);

    const noteGenerator = this.generateNotes(fromCursor, limit);

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
}
