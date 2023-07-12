import _ from 'lodash';
import { isUrl, putStrLn, setLogEnvLevel } from '@watr/commonlib';
import { MongoQueries } from './query-api';

import * as fc from 'fast-check';
import { genHttpStatus } from './mock-data';

describe('MongoDB Schemas', () => {
  setLogEnvLevel('debug');

  const mdb = new MongoQueries();

  beforeAll(async () => {
    await mdb.connect();
    await mdb.dropDatabase();
    await mdb.createDatabase();
  });

  afterAll(async () => {
    await mdb.close();
  });

  it('should create/find note status', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string(),
        fc.oneof(fc.string(), fc.webUrl()),
        fc.oneof(fc.string(), fc.webUrl()),
        async (noteId, urlstr1, urlstr2) => {
          // Insert new document
          await mdb.upsertNoteStatus({ noteId, urlstr: urlstr1 });
          const byId = await mdb.findNoteStatusById(noteId);
          expect(byId).toBeDefined();
          if (byId === undefined) {
            fail('invalid null value');
          }

          expect(byId.validUrl).toEqual(isUrl(urlstr1));

          // Modify existing document
          await mdb.upsertNoteStatus({ noteId, urlstr: urlstr2 });
          const modById = await mdb.findNoteStatusById(noteId);
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

  it('should create/find host status', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string(), // noteId
        fc.boolean(), // hasAbstract
        fc.webUrl(), // requestUrl
        fc.oneof(fc.string(), fc.webUrl()), // response
        // fc.oneof(fc.string(), fc.webUrl(), fc.constant(undefined)), // response
        genHttpStatus,
        fc.string(), // TODO workflowStatus
        async (noteId, hasAbstract, requestUrl, response, httpStatus, _workflowStatus) => {
          // Insert new document
          const ret = await mdb.upsertHostStatus(noteId, 'available', { hasAbstract, requestUrl, response, httpStatus });
          const byId = await mdb.findHostStatusById(noteId);
          expect(byId).toBeDefined();
          if (byId === undefined) {
            fail('invalid null value');
          }

          expect(byId).toEqual(ret);
          expect(byId.validResponseUrl).toEqual(isUrl(response));
          expect(byId.responseHost !== undefined).toEqual(isUrl(response));

          // const lockedStatus = await upsertHostStatus(noteId, 'spider:locked', {});
        }
      ),
      { verbose: true }
    );
  });

});
