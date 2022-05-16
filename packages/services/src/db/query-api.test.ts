import _ from 'lodash';
import { prettyPrint, setLogEnvLevel } from '@watr/commonlib';
import { connectToMongoDB } from './mongodb';
import { createCollections, HostStatus, NoteStatus } from './schemas';
import { Mongoose } from 'mongoose';
import { upsertHostStatus, upsertNoteStatus } from './query-api';

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

    it('should create note status', async () => {
        const noteStatus = new NoteStatus({
            noteId: 'asdlj',
            validUrl: false,
            url: 'http://me.com'
        });
        await noteStatus.save();

        const allNotes = await NoteStatus.find({})
        allNotes.forEach(note => {
            const noteObj = note.toObject();
            prettyPrint({ noteObj })
        });
        const byId = await NoteStatus.findOne({ noteId: 'asdlj' });
        prettyPrint({ byId })
    });

    it('upsert NoteStatus, allowing for existing entry', async () => {
        await upsertNoteStatus({ noteId: 'asdf', urlstr: 'invalidUrl' })
        const byId = await NoteStatus.findOne({ noteId: 'asdf' });
        prettyPrint({ byId })

        await upsertNoteStatus({ noteId: 'asdf', urlstr: 'http://one.org' })
        const byId1 = await NoteStatus.findOne({ noteId: 'asdf' });
        prettyPrint({ byId1 })

    });

    it('upsert HostStatus, allowing for existing entry', async () => {
        await upsertHostStatus('asdf', { hasAbstract: false })
        const byId = await HostStatus.findOne({ noteId: 'asdf' });
        prettyPrint({ byId })

        await upsertHostStatus('asdf', { hasAbstract: true, requestUrl: 'http://one.com', httpStatus: 200 });
        const byId1 = await HostStatus.findOne({ noteId: 'asdf' });
        prettyPrint({ byId1 })

    })

    it('create host status', async () => {
        const hostStatus = new HostStatus({
            noteId: 'asdlj',
            hasAbstract: false,
            validResponseUrl: true,
            requestUrl: 'http://me.com/foo/bar',
            response: 'http://me.com/blah',
            responseHost: 'me.com',
            httpStatus: 200,
        });
        await hostStatus.save();

        const all = await HostStatus.find({})
        all.forEach(hostStatus => {
            const hostStatusObj = hostStatus.toObject();
            prettyPrint({ hostStatusObj })
        });
        const byId = await HostStatus.findOne({ noteId: 'asdlj' });
        prettyPrint({ byId })
    });
})
