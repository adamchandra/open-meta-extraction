/*
 * REST communication with OpenReview
 */
import {
  getServiceLogger,
} from '@watr/commonlib';
import { Logger } from 'winston';

import {
  OpenReviewExchange,
} from './openreview-exchange';


export interface NoteContent {
  'abstract'?: string;
  pdf?: string;
  html?: string; // this is a URL
  venueid: string;
  title: string;
  authors: string[];
  tcdate: number;
  authorids: string[];
  venue: string;
  _bibtex: string;
}

export interface Note {
  id: string;
  content: NoteContent;
}

export interface Notes {
  notes: Note[];
  count: number;
}

export interface MessagePostData {
  subject: string;
  message: string,
  groups: string[];
}

const OpenreviewStatusGroup = 'OpenReview.net/Status';


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
    this.opex = new OpenReviewExchange();
  }

  async doFetchNotes(offset: number): Promise<Notes | undefined> {
    return this.opex.apiGET<Notes>('/notes', { invitation: 'dblp.org/-/record', sort: 'number:desc', offset });
  }

  /**
   * Fetch the next batch of notes newer than the given date
   */
  async fetchNotesByDate(minDate: number): Promise<Notes | undefined> {
    return this.opex.apiGET<Notes>('/notes', { invitation: 'dblp.org/-/record', tcdate: minDate, sort: 'tcdate:asc' });
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

    await this.opex.apiPOST<typeof noteUpdate, Note>('/notes', noteUpdate)
      .then(updatedNote => {
        if (!updatedNote) {
          this.log.error(`error updating note Note ${noteId}`);
          return;
        }
        this.log.info(`updated Note.${fieldName} ${noteId}; updateId: ${updatedNote.id}`);
        this.log.info(`      = '${fieldValue.slice(0, 75)} ...'`);
      })
  }

  /**
   * Send status notifications
   * The body of the request requires
   * { subject: <Some Status Title>, message: <Body>, groups: [ 'OpenReview.net/Status' ] }
   */
  async postStatusMessage(subject: string, message: string): Promise<void> {
    const mp = makeMessagePost(subject, message);
    this.log.info(`Sending message ${mp.subject}`);
    await this.opex.apiPOST('/messages', mp);
    this.log.info(`Sent message ${mp.subject}`);
  }

}

/**
 * Construct a status message
 *   The body of the request requires
 *   { subject: <Some Status Title>, message: <Body>, groups: [ 'OpenReview.net/Status' ] }
 */
function makeMessagePost(subject: string, message: string): MessagePostData {
  return {
    subject,
    message,
    groups: [OpenreviewStatusGroup]
  };
}
