import _ from 'lodash';

import { getServiceLogger } from '@watr/commonlib';

import { FetchCursor, NoteStatus, WorkflowStatus } from '~/db/schemas';

import {
  MongoQueries,
  HostStatusDocument,
  CursorRole,
} from '~/db/query-api';

import { Note, OpenReviewGateway, UpdatableField } from './openreview-gateway';
import { Logger } from 'winston';


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
  // async updateNoteFields(
  //   noteId: string,
  //   fields: Record<UpdatableField, string|undefined>
  // ): Promise<void> {
  //   asyncEachSeries(_.keys(fields), (key) => {
  //     const value = fields[key];
  //     if (value !== undefined) {
  //       await this.gate.doUpdateNoteField(noteId, key, value);

  //     }
  //   });
  //   await this.gate.doUpdateNoteField(noteId, fieldName, fieldValue);
  //   // TODO: change schema to something like:
  //   //    `${fieldname}_status`: found | not_found
  //   // await upsertHostStatus(noteId, 'extractor:success', {
  //   //   `has${fieldName}`,
  //   //   // hasAbstract,
  //   //   // hasPdfLink,
  //   //   // httpStatus,
  //   //   // response: responseUrl
  //   // });
  // }


  async doUpdateNoteField(
    noteId: string,
    fieldName: UpdatableField,
    fieldValue: string
  ): Promise<void> {
    await this.gate.doUpdateNoteField(noteId, fieldName, fieldValue);
    // TODO: change schema to something like:
    //    `${fieldname}_status`: found | not_found
    // await upsertHostStatus(noteId, 'extractor:success', {
    //   `has${fieldName}`,
    //   // hasAbstract,
    //   // hasPdfLink,
    //   // httpStatus,
    //   // response: responseUrl
    // });


  }

  async getNextAvailableUrl(): Promise<HostStatusDocument | undefined> {
    const nextSpiderable = await this.mdb.getNextSpiderableUrl();

    // TODO change this retry logic to only reset on code updates
    if (nextSpiderable === undefined) {
      this.log.info('runRelayExtract(): no more spiderable urls in mongo');
      await this.mdb.resetUrlsWithMissingFields();
      return;
    }
    return;
  }

  async releaseSpiderableUrl(hostStatus: HostStatusDocument, newStatus: WorkflowStatus): Promise<HostStatusDocument> {
    return this.mdb.releaseSpiderableUrl(hostStatus, newStatus);
  }

  async findNote(noteId: string): Promise<NoteStatus | undefined> {
    return this.mdb.findNoteStatusById(noteId);
  }

  async saveNote(note: Note, upsert: boolean): Promise<void> {
    const urlstr = note.content.html;
    const existingNote = await this.mdb.findNoteStatusById(note.id);
    const noteExists = existingNote !== undefined;
    if (noteExists && !upsert) {
      this.log.info('SaveNote: note already exists, skipping');
      return;
    }

    this.log.info(`SaveNote: ${noteExists ? 'overwriting existing' : 'inserting new'} note`);

    const noteStatus = await this.mdb.upsertNoteStatus({ noteId: note.id, number: note.number, urlstr });
    if (!noteStatus.validUrl) {
      this.log.info(`SaveNote: NoteStatus: invalid url '${urlstr}'`);
      return;
    }
    const requestUrl = noteStatus.url;
    if (requestUrl === undefined) {
      this.log.error(`Invalid state: NoteStatus(${note.id}).validUrl===true, url===undefined`);
      return;
    }

    const abs = note.content.abstract;
    const pdfLink = note.content.pdf;
    const hasAbstract = typeof abs === 'string';
    const hasPdfLink = typeof pdfLink === 'string';
    const status: WorkflowStatus = hasAbstract && hasPdfLink ? 'extractor:success' : 'available';
    await this.mdb.upsertHostStatus(note.id, status, { hasAbstract, hasPdfLink, requestUrl });

    if (hasAbstract) {
      this.mdb.upsertFieldStatus(note.id, 'abstract', abs, 'preexisting');
    }
    if (hasPdfLink) {
      this.mdb.upsertFieldStatus(note.id, 'pdf', pdfLink, 'preexisting');
    }
  }

  async updateCursor(role: CursorRole, noteId: string) {
    this.mdb.updateCursor(role, noteId);
  }

  async getCursor(role: CursorRole): Promise<FetchCursor | undefined> {
    return this.mdb.getCursor(role);
  }
}
