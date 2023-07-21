import _ from 'lodash';
import { asyncEachOfSeries } from '@watr/commonlib';
import * as fc from 'fast-check';
import { MongoQueries } from './query-api';
import { WorkflowStatuses } from './schemas';
import { Note, Notes } from '~/components/openreview-gateway';

export async function populateDBHostNoteStatus(mdb: MongoQueries, n: number) {
  await asyncEachOfSeries(
    _.range(n),
    async (index: number) => {
      const validUrl = index % 3 === 0;
      const urlstr = validUrl ? `http://host-${index % 5}/page/${index}` : 'no-url';
      await mdb.upsertNoteStatus({
        noteId: `note#${index}`,
        number: index, urlstr
      });

      const wi = index % WorkflowStatuses.length;
      const workflowStatus = WorkflowStatuses[wi];
      if (validUrl) {
        const httpStatus = (((index % 4) + 2) * 100) + (index % 3);
        await mdb.upsertUrlStatus(
          `note#${index}`,
          workflowStatus,
          {
            hasAbstract: index % 9 === 0,
            requestUrl: urlstr,
            response: urlstr,
            httpStatus
          });
      }
    }
  );
}
const a200s = Array(20).fill(200);
const a404s = Array(4).fill(200);
const aCodes = _.concat(a200s, a404s, [301, 302, 500]);
export const genHttpStatus = fc.oneof(
  ...(aCodes.map(n => fc.constant(n)))
);

type CreateFakeNote = {
  noteNumber: number;
  hasAbstract: boolean;
  hasHTMLLink: boolean;
  hasPDFLink: boolean;
};

export function createFakeNote({
  noteNumber,
  hasAbstract,
  hasHTMLLink,
  hasPDFLink,
}: CreateFakeNote): Note {
  const number = noteNumber;
  const minutes = noteNumber.toString().padStart(2, '0');
  const inputStr = `2023-07-10T18:${minutes}:12.629Z`;
  const date = new Date(inputStr);
  const dateAsNum = date.getTime();
  const abs = hasAbstract ? 'Some Abstract Text' : undefined;
  const pdf = hasPDFLink ? `http://localhost:9100/pdf/${number}` : undefined;
  const html = hasHTMLLink ? `http://localhost:9100/html/${number}` : undefined;

  return {
    id: `note#${number}`,
    number,
    cdate: dateAsNum,
    mdate: dateAsNum,
    tcdate: dateAsNum,
    tmdate: dateAsNum,
    content: {
      abstract: abs,
      pdf, // URL of PDF
      html, // URL for paper landing page
      venueid: '',
      title: `Research Paper ${number}`,
      authors: ['Adam Smith'],
      tcdate: 0,
      authorids: ['~asmith1;'],
      venue: '',
      _bibtex: '',
    }
  };
}

export function createFakeNoteList(count: number, startingNumber: number = 1): Note[] {
  const ids = _.range(startingNumber, startingNumber + count);
  return _.map(ids, (i) => createFakeNote({
    noteNumber: i,
    hasAbstract: false,
    hasPDFLink: false,
    hasHTMLLink: true
  }));
}

export function asNoteBatch(count: number, notes: Note[]): Notes {
  return {
    count,
    notes
  };
}

export function createFakeNotes(count: number, startingNumber: number = 1): Notes {
  const notes = createFakeNoteList(count, startingNumber);
  return asNoteBatch(count, notes);
}
