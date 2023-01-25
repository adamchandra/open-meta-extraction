/*
 * REST communication with OpenReview
 */
import {
  getServiceLogger,
} from '@watr/commonlib';
import { Logger } from 'winston';

import {
  displayRestError,
  Note,
  Notes,
  OpenReviewExchange,
  newOpenReviewExchange
} from './openreview-exchange';


const UpdateInvitations = {
  abstract: 'dblp.org/-/abstract',
  pdf: 'dblp.org/-/pdf',
};

export type UpdatableField = keyof typeof UpdateInvitations;

export class OpenReviewGateway {
  log: Logger;
  opex: OpenReviewExchange;

  constructor() {
    this.log = getServiceLogger('OpenReviewGateway')
    this.opex = newOpenReviewExchange(getServiceLogger('OpenReviewExchange'));
  }

  async doFetchNotes(offset: number): Promise<Notes | undefined> {
    return this.opex.apiGET<Notes>('/notes', { invitation: 'dblp.org/-/record', sort: 'number:desc', offset });
  }

  async doUpdateNoteField(
    noteId: string,
    fieldName: UpdatableField,
    fieldValue: string
  ): Promise<void> {
    const content: Record<string, string> = {};
    content[fieldName] = fieldValue;
    const invitation = UpdateInvitations[fieldName];
    const noteUpdate = {
      referent: noteId,
      content,
      invitation,
      readers: ['everyone'],
      writers: [],
      signatures: ['dblp.org']
    };
    this.log.info(`POSTing updated note ${noteId}`);
    await this.opex.getCredentials();
    await this.opex.configAxios()
      .post('/notes', noteUpdate)
      .then(r => {
        const updatedNote: Note = r.data;
        this.log.info(`updated Note.${fieldName} ${noteId}; updateId: ${updatedNote.id}`);
        this.log.info(`      = '${fieldValue.slice(0, 75)} ...'`);
      })
      .catch(error => {
        displayRestError(error);
        return undefined;
      });
  }

}
