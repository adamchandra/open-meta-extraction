import _ from 'lodash';
import { prettyPrint, setLogEnvLevel } from '@watr/commonlib';
import { FetchService } from './fetch-service';

import { respondWith } from '@watr/spider';
import { HostStatus, NoteStatus } from '~/db/schemas';
import { asNoteBatch, createFakeNote, createFakeNoteList, createFakeNotes } from '~/db/mock-data';
import { withServerAndCleanMongo } from './testing-utils';


function fakeNoteBatch(totalSize: number, batchSize: number) {
  return asNoteBatch(totalSize, createFakeNoteList(batchSize))
}

describe('Fetch Service', () => {

  setLogEnvLevel('trace');

  it.only('should create fake notes', async () => {
    // const fake = createFakeNote({
    //   noteNumber: 1,
    //   hasAbstract: false,
    //   hasPDFLink: false,
    //   hasHTMLLink: true
    // });
    // // prettyPrint({ fake })
    const notes = createFakeNotes(3)

    createFakeNotes(3, 2)
    createFakeNotes(3, 5)
    // prettyPrint({ notes })
  });

  it('should run fetch loop', async () => {
    let noteList = createFakeNoteList(3);
    const totalNotes = 4000;


    await withServerAndCleanMongo((r) => {
      r.get('/notes', (ctx) => {
        const { query } = ctx;
        const { after } = query;
        if (_.isString(after)) {
          noteList = _.dropWhile(noteList, (n) => n.id !== after);
          noteList = _.drop(noteList, 1);
        }
        respondWith(asNoteBatch(totalNotes, noteList))(ctx)
      });
      // r.post('/notes', assert-correct-post);
    }, async () => {
      const fetchService = new FetchService();
      await fetchService.runFetchLoop(4);
      // assert MongoDB is populated correctly

      const notes = await NoteStatus.find();
      notes.forEach(note => {
        prettyPrint({ note })
      });
      const hosts = await HostStatus.find();
      hosts.forEach(host => {
        prettyPrint({ host })
      });

      //
    });
  });

  it('should start fetch from cursor', async () => {
    await withServerAndCleanMongo((r) => {
      r.get('/notes', (ctx) => {
        const { query } = ctx;
        const { after } = query;
        // expect(after).toBeUndefined();

        respondWith(fakeNoteBatch(100, 3))(ctx)
      });
    }, async () => {
      const fetchService = new FetchService();
      // TODO create/test cursors
      await fetchService.runFetchLoop(4);
      const cursor = await fetchService.getFetchCursor();
      prettyPrint({ cursor })

    });
  });

  // it('should ', async () => {});
});
