import _ from 'lodash';

import {
  getServiceLogger,
} from '@watr/commonlib';


import { WorkflowStatus } from '~/db/schemas';

import {
  MongoQueries,
  HostStatusDocument,
} from '~/db/query-api';

import { Note, OpenReviewGateway, UpdatableField  } from './openreview-gateway';
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

  async saveNoteToShadowDB(note: Note): Promise<void> {
    const urlstr = note.content.html;
    const existingNote = await this.mdb.findNoteStatusById(note.id);
    const noteExists = existingNote !== undefined;
    if (noteExists) {
      this.log.info('Found fetched note in local MongoDB; stopping fetcher');
      return;
    }

    const noteStatus = await this.mdb.upsertNoteStatus({ noteId: note.id, urlstr });
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
    await this.mdb.upsertHostStatus(note.id, status, { hasAbstract, hasPdfLink, requestUrl });
  }
}
