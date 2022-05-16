import _ from 'lodash';
import { putStrLn, setLogEnvLevel } from '@watr/commonlib';
import { connectToMongoDB } from './mongodb';
import { Mongoose } from 'mongoose';
import { formatStatusMessages, showStatusSummary } from './extraction-summary';
import { populateDBHostNoteStatus } from './mongo-test-utils';
import { createCollections } from './schemas';

describe('Create Extraction Status Summary', () => {
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

    it('create status summary', async () => {
        await populateDBHostNoteStatus(200);
        const summaryMessages = await showStatusSummary();
        const formatted = formatStatusMessages(summaryMessages);
        putStrLn(formatted);
    });
})
