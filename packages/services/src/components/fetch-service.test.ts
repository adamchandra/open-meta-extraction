import _ from 'lodash';
import { initConfig, prettyPrint, setLogEnvLevel } from '@watr/commonlib';
import { FetchService } from './fetch-service';

import { connectToMongoDB, resetMongoDB } from '~/db/mongodb';
import { respondWith, withServer } from '@watr/spider';
import { HostStatus, NoteStatus } from '~/db/schemas';
import { asNoteBatch, createFakeNote, createFakeNoteList, createFakeNotes } from '~/db/mock-data';



const withServerAndCleanMongo: typeof withServer = async (setup, run) => {
  let mongoose: Awaited<ReturnType<typeof connectToMongoDB>> | undefined;

  try {
    const config = initConfig();
    const MongoDBName = config.get('mongodb:dbName');
    mongoose = await connectToMongoDB();
    if (! /.+test.*/.test(MongoDBName)) {
      throw new Error(`Tried to reset mongodb ${MongoDBName}; can only reset a db w/name matching /test/`);
    }
    await resetMongoDB();
    return await withServer(
      (r) => {
        r.post('/login', respondWith({ token: 'fake-token', user: { id: '~TestUser;' } }));
        setup(r)
      },
      run
    );
  } finally {
    if (mongoose) {
      await mongoose.connection.close();
    }
  }
}


describe('Fetch Service', () => {

  setLogEnvLevel('trace');

  it('should create fake notes', async () => {
    const fake = createFakeNote({
      noteNumber: 1,
      hasAbstract: false,
      hasPDFLink: false,
      hasHTMLLink: true
    });
    // prettyPrint({ fake })
    const notes = createFakeNotes(3)
    // prettyPrint({ notes })
  });

  it('should run fetch loop', async () => {
    let noteList = createFakeNoteList(3);
    const totalNotes = 4000;

    await withServerAndCleanMongo((r) => {
      r.get('/notes', (ctx) => {
        const { query } = ctx;
        const { after } = query;
        if (_.isString(after)) {
          noteList = _.dropWhile(noteList, (n) => n.id !== after);
          noteList = _.drop(noteList, 1);
        }
        respondWith(asNoteBatch(totalNotes, noteList))(ctx)
      });
      // r.post('/notes', assert-correct-post);
    }, async () => {
      const fetchService = new FetchService();
      await fetchService.runFetchLoop(undefined, 4);
      // assert MongoDB is populated correctly

      const notes = await NoteStatus.find();
      notes.forEach(note => {
        prettyPrint({ note })
      });
      const hosts = await HostStatus.find();
      hosts.forEach(host => {
        prettyPrint({ host })
      });

      //
    });
  });

  it('should start fetch from cursor', async () => {
    await withServerAndCleanMongo((r) => {
      r.get('/notes', (ctx) => {
        const { query } = ctx;
        const { after } = query;
        expect(after).toEqual('')
      });
    }, async () => {
      const fetchService = new FetchService();
      await fetchService.runFetchLoop(undefined, 4);

    });
  });

  // it('should ', async () => {});
});
