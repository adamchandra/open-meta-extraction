import _ from 'lodash';

import { prettyPrint, AlphaRecord, asyncMapSeries } from '@watr/commonlib';
import * as T from './db-tables';
import { useEmptyDatabase } from './db-test-utils';
import { getDBConfig } from './database';
import { DatabaseContext } from './db-api';

describe('Database Tables Basics', () => {
  const dbConfig = getDBConfig();
  const dbCtx: DatabaseContext | undefined = dbConfig ? { dbConfig } : undefined;
  expect(dbCtx).toBeDefined;

  if (dbConfig === undefined || dbCtx === undefined) return;

  it('UrlChain', async () => {
    const request_url = 'http://blah.blah/?q=1';
    const response_url = 'http://blah.blah/?q=1';
    const status_code = 'http:200';

    await useEmptyDatabase(dbConfig, async db => {
      await db.runTransaction(async (_sql, transaction) => {
        const newEntry = await T.UrlChain.create({
          request_url, response_url, status_code
        }, { transaction });
        const theUrl = newEntry.get({ plain: true });

        prettyPrint({ theUrl });
      });

      await db.run(async () => {
        return T.UrlChain.findAll()
          .then((urls) => {
            const plainUrls = urls.map(a => a.get({ plain: true }));
            prettyPrint({ plainUrls });
          });
      });
    });
  });

  it('AlphaRecord', async () => {
    const inputRecs: AlphaRecord[] = _.map(_.range(20), (n) => {
      const n0 = n % 2 === 0 ? 10 : 20;
      return ({
        noteId: `note-${n0}`, // primary key 1
        url: `url-${n0}`, // primary key 2
        dblpConfId: `dblp/conf/conf-${n}`,
        title: `titl-${n}`,
        authorId: `auth-${n}`,
      });
    });

    await useEmptyDatabase(dbConfig, async db => {
      await db.runTransaction(async (_sql, transaction) => {
        return asyncMapSeries(inputRecs, async (alphaRec: AlphaRecord) => {
          const [newEntry, isNew] = await T.NoteRecord.findOrCreate({
            where: {
              note_id: alphaRec.noteId,
              url: alphaRec.url,
            },
            defaults: {
              note_id: alphaRec.noteId,
              url: alphaRec.url,
              dblp_key: alphaRec.dblpConfId,
              author_id: alphaRec.authorId,
              title: alphaRec.title,
            },
            transaction,
          });

          const plainNewEntry = newEntry.get({ plain: true });
          // prettyPrint({ isNew, plainNewEntry });
          return plainNewEntry;
        });
      });

      await db.run(async () => {
        return T.NoteRecord.findAll()
          .then((alphaRecs) => {
            const plainRecs = alphaRecs.map(a => a.get({ plain: true }));
            // prettyPrint({ plainRecs });
            expect(alphaRecs.length).toBe(2);
          });
      });
    });
  });
});
