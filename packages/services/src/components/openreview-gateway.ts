/*
 * REST communication with OpenReview
*/

import _ from 'lodash';

import {
  asyncEachOfSeries,
  getServiceLogger, prettyPrint
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
  number: number,
  cdate: number,
  mdate: number,
  tcdate: number,
  tmdate: number,
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
    this.log = getServiceLogger('OpenReviewGateway');
    this.opex = new OpenReviewExchange();
  }

  // TODO delete this block
  // We just deployed  a change we discussed  with you a while back.  We now allow
  // querying notes using the after parameter instead of the offset parameter. The
  // after  parameter  is much  more  efficient  than  the offset  parameter  when
  // querying  dblp notes.  Would  you  mind making  the  change  in the  abstract
  // extractor? The change should hopefully  be straightforward. The after keyword
  // takes the  id of the last  note that was returned  by the backend and  a sort
  // parameter is required. In your case I think it's number:desc, so that remains
  // unchanged. For example, suppose you query the first page as follows:
  //
  // GET /notes?invitation=dblp.org/-/record&sort=number:desc
  //
  // Then the result contains the note ids: [ qwerew, 12eaxssr, ..., lastid123 ]
  //
  // In order to get the next page you would need to do the following call
  //
  // GET /notes?invitation=dblp.org/-/record&sort=number:desc&after=lastid123
  // and so on until you get all Notes.
  // Please let me know if something is not clear. Thanks! (edited)

  // async doFetchNotes(offset: number): Promise<Notes | undefined> {
  //   return this.opex.apiGET<Notes>('/notes', { invitation: 'dblp.org/-/record', sort: 'number:desc', offset });
  // }

  async fetchNotes(afterNoteId?: string): Promise<Notes | undefined> {
    const queryParams: Record<string, string> = { invitation: 'dblp.org/-/record', sort: 'number:asc' };
    if (afterNoteId) {
      queryParams.after = afterNoteId;
    }
    return this.opex.apiGET<Notes>('/notes', queryParams);
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
        return;
      });
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

  async testNoteFetching() {
    let startingNote: string | undefined;
    const noteList: any[][] = [];
    await asyncEachOfSeries(_.range(5), async () => {
      const notes = await this.fetchNotes(startingNote);

      if (notes) {
        const abbrevNotes = notes.notes.map(note => {
          const { id, number, cdate, tcdate, mdate, tmdate } = note;
          const mdateHr = fmtTime(mdate);
          const cdateHr = fmtTime(cdate);
          const tcdateHr = fmtTime(tcdate);
          const tmdateHr = fmtTime(tmdate);
          return {
            id, number, mdateHr, tmdateHr, cdateHr, tcdateHr
          };
        });
        const first10 = abbrevNotes.slice(0, 10);
        noteList.push(first10);
        startingNote = first10[0].id;
        // putStrLn(`Note Count = ${notes.count}`)
        // putStrLn(`Notes returned = ${notes.notes.length}`)
        // prettyPrint({ first10 });
      }
    });
    const zipped = _.zip(noteList);
    prettyPrint({ zipped });
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

export function fmtTime(unixTimestamp: number): string {
  const a = new Date(unixTimestamp);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const year = a.getFullYear();
  const month = months[a.getMonth()];
  const date = a.getDate();
  const hour = a.getHours();
  const min = a.getMinutes();
  const sec = a.getSeconds();
  const time = `${date} ${month} ${year} ${hour}:${min}:${sec}`;
  return time;
}
