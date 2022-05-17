import _ from 'lodash';
import { prettyPrint, setLogEnvLevel } from '@watr/commonlib';
import { connectToMongoDB } from './mongodb';
import { createCollections, HostStatus, NoteStatus } from './schemas';
import { Mongoose } from 'mongoose';
import { getNextSpiderableUrl, upsertHostStatus, upsertNoteStatus } from './query-api';

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


    it.only('get/update next spiderable host/url', async () => {
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

});
