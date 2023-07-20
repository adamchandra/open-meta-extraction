import _ from 'lodash';

import { getServiceLogger, putStrLn, shaEncodeAsHex } from '@watr/commonlib';

import { Logger } from 'winston';
import { FetchCursor, NoteStatus, WorkflowStatus } from '~/db/schemas';

import {
  MongoQueries,
  HostStatusDocument,
} from '~/db/query-api';

import { Note, OpenReviewGateway, UpdatableField } from './openreview-gateway';


export async function createShadowDB(): Promise<ShadowDB> {
  const s = new ShadowDB();
  await s.connect();
  return s;
}

export class ShadowDB {
  log: Logger;
  gate: OpenReviewGateway;
  mdb: MongoQueries;

  constructor() {
    this.log = getServiceLogger('ShadowDB');
    this.gate = new OpenReviewGateway();
    this.mdb = new MongoQueries();
  }

  async connect() {
    await this.mdb.connect();
  }

  async close() {
    await this.mdb.close();
  }

  async updateFieldStatus(
    noteId: string,
    fieldName: UpdatableField,
    fieldValue: string,
  ): Promise<void> {
    const priorStatus = await this.mdb.getFieldStatus(noteId, fieldName);
    const newFieldValueHash = shaEncodeAsHex(fieldValue);
    const fieldIsUnchanged = priorStatus && priorStatus.contentHash === newFieldValueHash;

    if (fieldIsUnchanged) {
      this.log.info(`Updating note ${noteId}: ${fieldName} is unchanged`)
      return;
    }

    await this.mdb.upsertFieldStatus(
      noteId,
      fieldName,
      fieldValue
    );
    await this.gate.updateFieldStatus(noteId, fieldName, fieldValue);
  }

  async getNextAvailableUrl(): Promise<FetchCursor | undefined> {
    // TODO this could indefinitely lock a cursor
    // perhaps use uniq ids for workers to disambiguate
    let cursor = await this.mdb.getCursor('extract-fields');
    if (!cursor) {
      const note1 = await this.mdb.getNextNoteWithValidURL(-1);
      if (!note1) return;
      cursor = await this.mdb.createCursor('extract-fields', note1._id);
    }
    if (!cursor) return;
    return this.mdb.advanceCursor(cursor._id);
    // return this.mdb.lockCursor(cursor._id);
  }

  async getHostStatusForCursor(cursor: FetchCursor): Promise<HostStatusDocument | undefined> {
    return this.mdb.findHostStatusById(cursor.noteId);
  }

  async releaseSpiderableUrl(cursor: FetchCursor): Promise<void> {
    // await this.mdb.unlockCursor(cursor._id);
    // await this.mdb.advanceCursor(cursor._id);
  }

  async findNote(noteId: string): Promise<NoteStatus | undefined> {
    return this.mdb.findNoteStatusById(noteId);
  }

  async saveNote(note: Note, upsert: boolean): Promise<void> {
    const urlstr = note.content.html;
    putStrLn(`saveNote(${note.id}, upsert: ${upsert})`);
    const existingNote = await this.mdb.findNoteStatusById(note.id);
    const noteExists = existingNote !== undefined;
    putStrLn(`saveNote(${note.id}); existing? ${noteExists}`);
    if (noteExists && !upsert) {
      this.log.info('SaveNote: note already exists, skipping');
      return;
    }

    this.log.info(`SaveNote: ${noteExists ? 'overwriting existing' : 'inserting new'} note`);

    putStrLn(`saveNote(${note.id}); upserting...`);
    const noteStatus = await this.mdb.upsertNoteStatus({ noteId: note.id, number: note.number, urlstr });
    if (!noteStatus.validUrl) {
      this.log.debug('SaveNote: no valid url.');
      return;
    }
    const requestUrl = noteStatus.url;
    if (requestUrl === undefined) {
      this.log.error(`Invalid state: NoteStatus(${note.id}).validUrl===true, url===undefined`);
      return;
    }

    putStrLn(`saveNote(${note.id}); field updates...`);
    const abs = note.content.abstract;
    const pdfLink = note.content.pdf;
    const hasAbstract = typeof abs === 'string';
    const hasPdfLink = typeof pdfLink === 'string';
    const status: WorkflowStatus = hasAbstract && hasPdfLink ? 'extractor:success' : 'available';
    await this.mdb.upsertHostStatus(note.id, status, { hasAbstract, hasPdfLink, requestUrl });

    if (hasAbstract) {
      await this.mdb.upsertFieldStatus(note.id, 'abstract', abs);
    }
    if (hasPdfLink) {
      await this.mdb.upsertFieldStatus(note.id, 'pdf', pdfLink);
    }
  }

  async updateLastFetchedNote(noteId: string): Promise<void> {
    await this.mdb.updateCursor('fetch-openreview-notes', noteId);
  }

  async getLastFetchedNote(): Promise<FetchCursor | undefined> {
    return this.mdb.getCursor('fetch-openreview-notes');
  }

}
