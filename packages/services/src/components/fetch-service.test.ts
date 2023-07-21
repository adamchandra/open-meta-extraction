import _ from 'lodash';
import { setLogEnvLevel } from '@watr/commonlib';
import { respondWith } from '@watr/spider';
import { FetchService } from './fetch-service';

import { FetchCursor, UrlStatus, NoteStatus } from '~/db/schemas';
import { asNoteBatch, createFakeNoteList, createFakeNotes } from '~/db/mock-data';
import { withServerAndCleanMongo } from './testing-utils';


describe('Fetch Service', () => {
  setLogEnvLevel('warn');

  it('should create fake notes', async () => {
    const notes = createFakeNotes(3);
    expect(notes.notes[0]).toMatchObject({ id: 'note#1', number: 1 });
    expect(notes.notes[2]).toMatchObject({ id: 'note#3', number: 3 });

    expect(createFakeNotes(2, 2).notes)
      .toMatchObject([{ id: 'note#2', number: 2 }, { id: 'note#3', number: 3 }]);
  });

  it('should run fetch loop with cursor', async () => {
    const totalNotes = 4000;
    const batchSize = 3;
    const fourNoteIds = _.range(4).map(i => `note#${i+1}`);
    const eightNoteIds = _.range(8).map(i => `note#${i+1}`);

    await withServerAndCleanMongo((r) => {
      r.get('/notes', (ctx) => {
        const { query } = ctx;
        const { after } = query;
        let prevIdNum = 0;
        if (_.isString(after)) {
          const idnum = after.split('#')[1];
          prevIdNum = Number.parseInt(idnum, 10);
        }
        const noteList = createFakeNoteList(batchSize, prevIdNum+1);
        respondWith(asNoteBatch(totalNotes, noteList))(ctx);
      });
    }, async () => {
      const fetchService = new FetchService();
      await fetchService.runFetchLoop(4);

      // assert MongoDB is populated correctly
      let notes = await NoteStatus.find();
      expect(notes.map(n => n.id)).toMatchObject(fourNoteIds);

      let cursors = await FetchCursor.find();
      expect(cursors.map(n => n.noteId)).toMatchObject(['note#4']);
      let hosts = await UrlStatus.find();
      expect(hosts.map(n => n._id)).toMatchObject(fourNoteIds);


      await fetchService.runFetchLoop(4);

      notes = await NoteStatus.find();
      expect(notes.map(n => n.id)).toMatchObject(eightNoteIds);

      cursors = await FetchCursor.find();
      expect(cursors.map(n => n.noteId)).toMatchObject(['note#8']);
      hosts = await UrlStatus.find();
      expect(hosts.map(n => n._id)).toMatchObject(eightNoteIds);
    });
  });
});
