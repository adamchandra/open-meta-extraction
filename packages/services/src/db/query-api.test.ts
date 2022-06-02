import _ from 'lodash';
import { setLogEnvLevel } from '@watr/commonlib';
import { connectToMongoDB } from './mongodb';
import { createCollections } from './schemas';
import { Mongoose } from 'mongoose';
import {  getNextSpiderableUrl, resetUrlsWithoutAbstracts, upsertHostStatus, upsertNoteStatus } from './query-api';
import {  populateDBHostNoteStatus } from './mongo-test-utils';

describe('MongoDB Queries', () => {
  setLogEnvLevel('debug');

  let mongoose: Mongoose | undefined = undefined;

  beforeEach(async () => {
    mongoose = await connectToMongoDB();
    await mongoose.connection.dropDatabase();
    await createCollections();
  });

  afterAll(async () => {
    if (mongoose === undefined) return;
    return mongoose.connection.close();
  });


  it('get/update next spiderable host/url', async () => {
    const initEntry = await upsertHostStatus('asdf', 'available', { hasAbstract: false });

    expect(initEntry._id).toEqual('asdf')

    const nextSpiderable = await getNextSpiderableUrl();

    expect(nextSpiderable).toBeDefined

    if (nextSpiderable !== undefined) {
      const noteId = nextSpiderable._id;
      const updateRes = await upsertHostStatus(noteId, 'spider:success', {
        httpStatus: 200
      });
      expect(updateRes._id).toEqual('asdf')
    }
  });

  it('should release all locks, allow for re-extraction of failed notes', async () => {
    await populateDBHostNoteStatus(200);
    // putStrLn(formatStatusMessages(await showStatusSummary()));
    await resetUrlsWithoutAbstracts();
    // putStrLn(formatStatusMessages(await showStatusSummary()));
  });
});
