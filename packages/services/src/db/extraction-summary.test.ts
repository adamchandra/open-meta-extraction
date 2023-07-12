import _ from 'lodash';
import { putStrLn, setLogEnvLevel } from '@watr/commonlib';
import { formatStatusMessages, showStatusSummary } from './extraction-summary';
import { populateDBHostNoteStatus } from './mock-data';
import { MongoQueries } from './query-api';

describe('Create Extraction Status Summary', () => {
  setLogEnvLevel('debug');

  const mdb = new MongoQueries();

  beforeAll(async () => {
    await mdb.connect();
  });

  afterAll(async () => {
    await mdb.close();
  });


  beforeEach(async () => {
    await mdb.dropDatabase();
    await mdb.createDatabase();
  });

  it('create status summary', async () => {
    await populateDBHostNoteStatus(mdb, 200);
    const summaryMessages = await showStatusSummary();
    const formatted = formatStatusMessages(summaryMessages);
    putStrLn(formatted);
  });
});
