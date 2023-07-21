import _ from 'lodash';
import { prettyPrint, setLogEnvLevel } from '@watr/commonlib';
import { MongoQueries } from './query-api';
import { populateDBHostNoteStatus } from './mock-data';
import { withMongo } from './mongodb';

describe('MongoDB Queries', () => {
  setLogEnvLevel('debug');

  const mdb = new MongoQueries();

  beforeAll(async () => {
    await mdb.connect();
  });

  beforeEach(async () => {
    // await mdb.dropDatabase();
    // await mdb.createDatabase();
  });

  afterAll(async () => {
    await mdb.close();
  });


  it('should crud noteStatus records', async () => {});

  it('should create/update/delete fetch cursors', async () => {
    expect(await mdb.getCursor('extract-fields')).toBeUndefined();
    expect(await mdb.getCursor('fetch-openreview-notes')).toBeUndefined();
    expect(await mdb.updateCursor('extract-fields', '1')).toMatchObject({ role: 'extract-fields', noteId: '1' });
    expect(await mdb.updateCursor('extract-fields', '2')).toMatchObject({ role: 'extract-abstract', noteId: '2' });
    expect(await mdb.updateCursor('extract-fields', '2')).toMatchObject({ role: 'extract-pdf-link', noteId: '2' });
    expect(await mdb.deleteCursor('extract-fields')).toBe(true);
    expect(await mdb.deleteCursor('extract-fields')).toBe(false);
    expect(await mdb.getCursor('extract-fields')).toBeUndefined();
  });

  it.only('should lock/unlock/advance cursors', async () => {
    await withMongo(async () => {
      const nocursor = await mdb.createCursor('extract-fields', 'note#1');
      expect(nocursor).toBeUndefined();

      await populateDBHostNoteStatus(mdb, 20);
      const cursor = await mdb.createCursor('extract-fields', 'note#1');
      expect(cursor).toBeDefined();
      if (!cursor) return;

      const locked = await mdb.lockCursor(cursor._id);
      const unlocked = await mdb.unlockCursor(cursor._id);
      const advanced = await mdb.advanceCursor(cursor._id);

      prettyPrint({ cursor, locked, unlocked, advanced });

    }, true)

  });


  it('get/update next spiderable host/url', async () => {
    // select UrlStatus hs on hs.requestUrl == ns.url
    //   join FieldStatus fs on fs.


    const initEntry = await mdb.upsertUrlStatus('asdf', 'unknown', { hasAbstract: false });

    expect(initEntry._id).toEqual('asdf');

    // const nextSpiderable = await mdb.getNextSpiderableUrl();

    // expect(nextSpiderable).toBeDefined;

    // if (nextSpiderable !== undefined) {
    //   const noteId = nextSpiderable._id;
    //   const updateRes = await mdb.upsertUrlStatus(noteId, 'spider:success', {
    //     httpStatus: 200
    //   });
    //   expect(updateRes._id).toEqual('asdf');
    // }
  });

  it('should release all locks, allow for re-extraction of failed notes', async () => {
    await populateDBHostNoteStatus(mdb, 200);
  });

  // it.only('should record success/failure of field extraction', async () => {});
  // it('should record success/failure of field extraction', async () => {});
  // it('should find all notes w/unattempted field extractions', async () => {});
});
