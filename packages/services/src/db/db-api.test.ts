import _ from 'lodash';

import { prettyPrint, AlphaRecord } from '@watr/commonlib';
import { mockAlphaRecord, mockUrlFetchData } from '@watr/spider';
import { useEmptyDatabase } from './db-test-utils';
import { commitUrlFetchData, DatabaseContext, getNextUrlForSpidering, insertAlphaRecords, insertNewUrlChains } from './db-api';
import { getDBConfig } from './database';

// TODO create per-unit-test database instances https://dev.to/walrusai/testing-database-interactions-with-jest-519n


describe('High-level Database API', () => {
  const dbConfig = getDBConfig();
  const dbCtx: DatabaseContext | undefined = dbConfig ? { dbConfig } : undefined;
  expect(dbCtx).toBeDefined;

  if (dbConfig === undefined || dbCtx === undefined) return;

  const inputRecs: AlphaRecord[] = _.map(_.range(40), (n) => {
    const n0 = n % 5 === 0 ? 42 : n;
    return ({
      noteId: `note-${n}`,
      dblpConfId: `dblp/conf/conf-${n}`, // TODO rename to dblpKey
      title: `titl-${n}`,
      authorId: `auth-${n}`,
      url: `http://foo${n0}.bar/${n0}`,
    });
  });

  const uniqRecs = _.uniqBy(inputRecs, r => r.url);

  beforeEach(async () => {
    return useEmptyDatabase(dbConfig, async () => {});
  });

  it('should create new alpha records and insert new url chains', async () => {
    const newAlphaRecs = await insertAlphaRecords(dbCtx, inputRecs);
    _.each(newAlphaRecs, r => {
      const rplain = r.get({ plain: true });
      // prettyPrint({ rplain });
    });
    const updateCount = await insertNewUrlChains(dbCtx);

    expect(updateCount).toEqual(uniqRecs.length);
  });

  it('should select next url for spidering', async () => {
    await insertAlphaRecords(dbCtx, inputRecs);
    await insertNewUrlChains(dbCtx);
    const nextUrl = await getNextUrlForSpidering(dbCtx);
    // prettyPrint({ nextUrl });
  });


  it('should commit spidering metadata to db', async () => {
    const metadata = mockUrlFetchData(3);
    const alphaRecord = mockAlphaRecord(0);
    // prettyPrint({ metadata, alphaRecord });

    await insertAlphaRecords(dbCtx, [alphaRecord]);
    await insertNewUrlChains(dbCtx);
    const nextUrl = await getNextUrlForSpidering(dbCtx);
    // prettyPrint({ nextUrl });
    const commitedMeta = await commitUrlFetchData(dbCtx, metadata);
    // prettyPrint({ commitedMeta });
    const { requestUrl } = metadata;
    // prettyPrint({ requestUrl });
  });
});
