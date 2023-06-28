import _ from 'lodash';

import {
  asyncEachSeries,
  getServiceLogger,
  delay,
  asyncForever
} from '@watr/commonlib';


import { WorkflowStatus } from '~/db/schemas';

import {
  findNoteStatusById,
  getNextSpiderableUrl,
  HostStatusDocument,
  resetUrlsWithMissingFields,
  upsertHostStatus,
  upsertNoteStatus,
  releaseSpiderableUrl
} from '~/db/query-api';

import { OpenReviewGateway, UpdatableField, Note, Notes } from './openreview-gateway';
import { Logger } from 'winston';


export class ShadowDB {
  log: Logger;
  gate: OpenReviewGateway;


  constructor() {
    this.log = getServiceLogger('ShadowDB');
    this.gate = new OpenReviewGateway();
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
    const nextSpiderable = await getNextSpiderableUrl();

    // TODO change this retry logic to only reset on code updates
    if (nextSpiderable === undefined) {
      this.log.info('runRelayExtract(): no more spiderable urls in mongo');
      await resetUrlsWithMissingFields();
      return;
    }
    return;
  }

  async releaseSpiderableUrl(hostStatus: HostStatusDocument, newStatus: WorkflowStatus): Promise<HostStatusDocument> {
    return releaseSpiderableUrl(hostStatus, newStatus);
  }

  /**
   * params:
   *   fetch sort order (newest/oldest)
   *   fetch starting offset
   *   fetch count
   *
   */
  async doFetchNotes(offset: number): Promise<Notes | undefined> {
    const self = this;
    try {
      const nextNotes = await self.gate.doFetchNotes(offset);
      if (!nextNotes) {
        return;
      }

      const { notes, count } = nextNotes;
      const fetchLength = notes.length;

      self.log.info(`fetched ${notes.length} (of ${count}) notes`);

      // offset += fetchLength;

      // const noteSliceEndIndex = runForever ? fetchLength : numProcessed + numToFetch;
      // const notesToProcess = notes.slice(0, noteSliceEndIndex);

      // self.log.info(`Processing a batch of size ${notesToProcess.length}`);
      // const addedNoteCount = await self._commitNoteBatch(notesToProcess, true);
      // self.log.info(`  ... added ${addedNoteCount} notes`);
      // numProcessed += addedNoteCount;
      // self.log.info(`Upserted (${numProcessed}/${count})`);
    } catch (error) {
      return Promise.reject(error);
    }

    return undefined;
  }

  async _commitNoteBatch(notes: Note[], stopOnExistingNote: boolean): Promise<number> {
    let numProcessed = 0;
    let doneProcessing = false;

    await asyncEachSeries(notes, async (note: Note) => {
      if (doneProcessing) return;

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
