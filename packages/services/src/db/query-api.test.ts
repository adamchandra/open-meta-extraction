import _ from 'lodash';
import { prettyPrint, putStrLn, setLogEnvLevel } from '@watr/commonlib';
import { connectToMongoDB } from './mongodb';
import { createCollections, HostStatus, NoteStatus } from './schemas';
import { Mongoose } from 'mongoose';
import { getNextSpiderableUrl, resetUrlsWithoutAbstracts, upsertHostStatus, upsertNoteStatus } from './query-api';
import { genHttpStatus, populateDBHostNoteStatus } from './mongo-test-utils';
import { formatStatusMessages, showStatusSummary } from './extraction-summary';
import * as fc from 'fast-check';

describe('MongoDB Queries', () => {
    setLogEnvLevel('debug');

    let mongoose: Mongoose | undefined = undefined;

    beforeEach(async () => {
        mongoose = await connectToMongoDB();
        await mongoose.connection.dropDatabase()
        await createCollections();
    });

    afterAll(async () => {
        if (mongoose === undefined) return;
        return mongoose.connection.close()
    });


    it('get/update next spiderable host/url', async () => {
        const initEntry = await upsertHostStatus('asdf', 'available', { hasAbstract: false })

        const nextSpiderable = await getNextSpiderableUrl();
        prettyPrint({ initEntry, nextSpiderable })

        if (nextSpiderable !== undefined) {
            const noteId = nextSpiderable._id;
            const updateRes = await upsertHostStatus(noteId, 'spider:success', {
                httpStatus: 200
            });
            prettyPrint({ updateRes })
        }
    });

    it.only('should release all locks, allow for re-extraction of failed notes', async () => {
        await populateDBHostNoteStatus(200);
        putStrLn(formatStatusMessages(await showStatusSummary()))
        await resetUrlsWithoutAbstracts();
        putStrLn(formatStatusMessages(await showStatusSummary()))
    });

    // it.only('should create/find host status', async () => {
    //     await fc.assert(
    //         fc.asyncProperty(
    //             fc.string(), // noteId
    //             fc.boolean(), // hasAbstract
    //             fc.webUrl(), // requestUrl
    //             fc.oneof(fc.string(), fc.webUrl()), // response
    //             // fc.oneof(fc.string(), fc.webUrl(), fc.constant(undefined)), // response
    //             genHttpStatus,
    //             fc.string(), // TODO workflowStatus
    //             async (noteId, hasAbstract, requestUrl, response, httpStatus, workflowStatus) => {
    //                 // Insert new document
    //                 const ret = await upsertHostStatus(noteId, 'available', { hasAbstract, requestUrl, response, httpStatus });
    //                 const byId = await findHostStatusById(noteId);
    //                 expect(byId).toBeDefined();
    //                 if (byId === undefined) {
    //                     fail('invalid null value')
    //                 }

    //                 expect(byId).toEqual(ret);
    //                 expect(byId.validResponseUrl).toEqual(isUrl(response));
    //                 expect(byId.responseHost !== undefined).toEqual(isUrl(response));

    //                 const lockedStatus = await upsertHostStatus(noteId, 'spider:locked', {});
    //                 prettyPrint({ byId, lockedStatus })
    //             }
    //         ),
    //         { verbose: true }
    //     )
    // });
});
