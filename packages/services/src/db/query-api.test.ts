import _ from 'lodash';
import { setLogEnvLevel } from '@watr/commonlib';
import { MongoQueries } from './query-api';
import { populateDBHostNoteStatus } from './mock-data';

describe('MongoDB Queries', () => {
  setLogEnvLevel('debug');

  const mdb = new MongoQueries();

  beforeAll(async () => {
    await mdb.connect();
  });

  beforeEach(async () => {
    await mdb.dropDatabase();
    await mdb.createDatabase();
  });

  afterAll(async () => {
    await mdb.close();
  });



  it('should crud noteStatus records', async () => {

  });

  it('should create/update/delete fetch cursors', async () => {
    expect(await mdb.getCursor('extract-*')).toBeUndefined()
    expect(await mdb.getCursor('fetch-openreview-notes')).toBeUndefined()
    expect(await mdb.updateCursor('extract-*', '1')).toMatchObject({ role: 'extract-*', noteId: '1' })
    expect(await mdb.updateCursor('extract-abstract', '2')).toMatchObject({ role: 'extract-abstract', noteId: '2' })
    expect(await mdb.updateCursor('extract-pdf-link', '2')).toMatchObject({ role: 'extract-pdf-link', noteId: '2' });
    expect(await mdb.deleteCursor('extract-*')).toBe(true);
    expect(await mdb.deleteCursor('extract-*')).toBe(false);
    expect(await mdb.getCursor('extract-*')).toBeUndefined()
  });

  it('get/update next spiderable host/url', async () => {
    const initEntry = await mdb.upsertHostStatus('asdf', 'available', { hasAbstract: false });

    expect(initEntry._id).toEqual('asdf')

    const nextSpiderable = await mdb.getNextSpiderableUrl();

    expect(nextSpiderable).toBeDefined

    if (nextSpiderable !== undefined) {
      const noteId = nextSpiderable._id;
      const updateRes = await mdb.upsertHostStatus(noteId, 'spider:success', {
        httpStatus: 200
      });
      expect(updateRes._id).toEqual('asdf')
    }
  });

  it('should release all locks, allow for re-extraction of failed notes', async () => {
    await populateDBHostNoteStatus(mdb, 200);
    // putStrLn(formatStatusMessages(await showStatusSummary()));
    await mdb.resetUrlsWithMissingFields();
    // putStrLn(formatStatusMessages(await showStatusSummary()));
  });

  // it.only('should record success/failure of field extraction', async () => {});

  // it('should record success/failure of field extraction', async () => {});
  // it('should find all notes w/unattempted field extractions', async () => {});
});
