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

  it('should create/update/delete fetch cursors', async () => {
    expect(await mdb.getNamedCursor('front-cursor')).toBeUndefined()
    expect(await mdb.getNamedCursor('rear-cursor')).toBeUndefined()
    expect(await mdb.updateFetchCursor('rear-cursor', '1', '*')).toMatchObject({ name: 'rear-cursor', noteId: '1', fieldName: '*' })
    expect(await mdb.updateFetchCursor('rear-cursor', '2', 'abstract')).toMatchObject({ name: 'rear-cursor', noteId: '2', fieldName: 'abstract' })
    expect(await mdb.updateFetchCursor('front-cursor', '2', 'pdf-link')).toMatchObject({ name: 'front-cursor', noteId: '2', fieldName: 'pdf-link' });
    expect(await mdb.deleteNamedCursor('front-cursor')).toBe(true);
    expect(await mdb.deleteNamedCursor('front-cursor')).toBe(false);
    expect(await mdb.getNamedCursor('front-cursor')).toBeUndefined()
  });

  it.only('should record success/failure of field extraction', async () => {

  });

  // it('should crud noteStatus records', async () => {});
  // it('should record success/failure of field extraction', async () => {});
  // it('should find all notes w/unattempted field extractions', async () => {});
});
