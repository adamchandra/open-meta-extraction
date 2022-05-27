import _ from 'lodash';
import { isUrl, prettyPrint, putStrLn, setLogEnvLevel } from '@watr/commonlib';
import { connectToMongoDB } from './mongodb';
import { createCollections } from './schemas';
import { Mongoose } from 'mongoose';
import { findHostStatusById, findNoteStatusById, upsertHostStatus, upsertNoteStatus } from './query-api';

import * as fc from 'fast-check';
import { genHttpStatus } from './mongo-test-utils';

describe('MongoDB Schemas', () => {
  setLogEnvLevel('debug');

  let mongoose: Mongoose | undefined = undefined;

  beforeEach(async () => {
    mongoose = await connectToMongoDB();
    await mongoose.connection.dropDatabase();
    await createCollections();
    putStrLn('MongoDB connected');
  });

  afterAll(async () => {
    if (mongoose === undefined) return;
    putStrLn('MongoDB closing');
    return mongoose.connection.close();
  });

  it('should create/find note status', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string(),
        fc.oneof(fc.string(), fc.webUrl()),
        fc.oneof(fc.string(), fc.webUrl()),
        async (noteId, urlstr1, urlstr2) => {
          // Insert new document
          const ret = await upsertNoteStatus({ noteId, urlstr: urlstr1 });
          const byId = await findNoteStatusById(noteId);
          expect(byId).toBeDefined();
          if (byId === undefined) {
            fail('invalid null value');
          }

          expect(byId.validUrl).toEqual(isUrl(urlstr1));

          // Modify existing document
          const mod = await upsertNoteStatus({ noteId, urlstr: urlstr2 });
          const modById = await findNoteStatusById(noteId);
          expect(modById).toBeDefined();
          if (modById === undefined) {
            fail('invalid null value');
          }
          expect(modById.validUrl).toEqual(isUrl(urlstr2));
        }
      ),
      { verbose: true }
    );
  });

  it.only('should create/find host status', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string(), // noteId
        fc.boolean(), // hasAbstract
        fc.webUrl(), // requestUrl
        fc.oneof(fc.string(), fc.webUrl()), // response
        // fc.oneof(fc.string(), fc.webUrl(), fc.constant(undefined)), // response
        genHttpStatus,
        fc.string(), // TODO workflowStatus
        async (noteId, hasAbstract, requestUrl, response, httpStatus, workflowStatus) => {
          // Insert new document
          const ret = await upsertHostStatus(noteId, 'available', { hasAbstract, requestUrl, response, httpStatus });
          const byId = await findHostStatusById(noteId);
          expect(byId).toBeDefined();
          if (byId === undefined) {
            fail('invalid null value');
          }

          expect(byId).toEqual(ret);
          expect(byId.validResponseUrl).toEqual(isUrl(response));
          expect(byId.responseHost !== undefined).toEqual(isUrl(response));

          const lockedStatus = await upsertHostStatus(noteId, 'spider:locked', {});
          prettyPrint({ byId, lockedStatus });
        }
      ),
      { verbose: true }
    );
  });

});
