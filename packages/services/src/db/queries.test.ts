import _ from 'lodash';
import { asyncEachOfSeries, prettyPrint, putStrLn, setLogEnvLevel } from '@watr/commonlib';
import { connectToMongoDB, createCollections, HostStatus, useMockTimestamps } from './mongodb';
import { Mongoose } from 'mongoose';
import { formatStatusMessages, showStatusSummary } from './queries';

describe('MongoDB Queries', () => {
    setLogEnvLevel('debug');

    let mongoose: Mongoose | undefined = undefined;

    beforeEach(async () => {
        useMockTimestamps();
        mongoose = await connectToMongoDB();
        await mongoose.connection.dropDatabase()
        await createCollections();
    });

    afterAll(async () => {
        if (mongoose === undefined) return;
        return mongoose.connection.close()
    });

    async function populateDB(n: number) {
        await asyncEachOfSeries(
            _.range(n),
            async (index: number) => {
                const host = `http://host-${index % 5}`;
                const url = `${host}/page/${index}`;
                const httpStatus = (((index % 4) + 2) * 100) + (index % 3)

                const hostStatus = new HostStatus({
                    noteId: `note#${index}`,
                    hasUrl: index % 3 === 0,
                    hasAbstract: index % 9 === 0,
                    requestUrl: url,
                    responseUrl: url,
                    responseHost: host,
                    httpStatus,
                });
                await hostStatus.save();
            }
        );

    }

    it('create host status', async () => {
        const hostStatus = new HostStatus({
            requestUrl: 'http://me.com/foo/bar',
            responseUrl: 'http://me.com/blah',
            responseHost: 'me.com',
            httpStatus: 200,
            extractedFields: ['abstract', 'author']
        });
        await hostStatus.save();

        const all = await HostStatus.find({})
        all.forEach(hostStatus => {
            const hostStatusObj = hostStatus.toObject();
            prettyPrint({ hostStatusObj })
        })
    });

    it.only('create status summary', async () => {
        await populateDB(20000);
        const summaryMessages = await showStatusSummary();
        const formatted = formatStatusMessages(summaryMessages);
        putStrLn(formatted);

    });
})
