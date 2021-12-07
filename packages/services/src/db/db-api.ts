import _ from 'lodash';

import { stripMargin, putStrLn, AlphaRecord } from '@watr/commonlib';
import Async from 'async';

import { UrlFetchData } from '@watr/spider';
import { DBConfig, openDatabase } from './database';
import * as DB from './db-tables';

export interface DatabaseContext {
  dbConfig: DBConfig;
}

export async function insertAlphaRecords(
  dbCtx: DatabaseContext,
  inputRecs: AlphaRecord[],
): Promise<DB.AlphaRecord[]> {
  const db = await openDatabase(dbCtx.dbConfig);
  const ins = await db.run(async (_sql) => {
    let inserted = 0;
    let processed = 0;
    return Async.mapSeries<AlphaRecord, DB.AlphaRecord, Error>(
      inputRecs,
      Async.asyncify(async (rec: AlphaRecord) => {
        if (processed % 100 === 0) {
          putStrLn(`processed ${processed}: new = ${inserted} total = ${inputRecs.length}...`);
        }

        const [newEntry, isNew] = await DB.AlphaRecord.findOrCreate({
          where: {
            note_id: rec.noteId,
            url: rec.url,
          },
          defaults: {
            note_id: rec.noteId,
            url: rec.url,
            dblp_key: rec.dblpConfId,
            author_id: rec.authorId,
            title: rec.title,
          },
        });

        processed += 1;
        inserted += isNew ? 1 : 0;

        return newEntry;
      }));
  });
  await db.close();
  return ins;
}


export async function insertNewUrlChains(
  dbCtx: DatabaseContext,
): Promise<number> {
  const db = await openDatabase(dbCtx.dbConfig);

  const [queryResults,] = await db.run(async (sql) => {
    const results = await sql.query(stripMargin(`
|INSERT INTO "UrlChains" (
|  SELECT DISTINCT
|    ar.url AS request_url,
|    null as response_url,
|    'status:new' as status_code,
|    null as status_message,
|    NOW() as "createdAt",
|    NOW() as "updatedAt"
|  FROM "AlphaRecords" ar
|  LEFT JOIN "UrlChains" uc
|  ON ar.url=uc.request_url
|  WHERE uc.request_url IS NULL
|)
|RETURNING request_url
|`));
    return results;
  });

  const updated = queryResults.length;
  await db.close();
  return updated;
}

export async function getNextUrlForSpidering(
  dbCtx: DatabaseContext,
): Promise<string | undefined> {
  const db = await openDatabase(dbCtx.dbConfig);
  const [queryResults] = await db.run(async (sql) => {
    const results = await sql.query(stripMargin(`
|       UPDATE "UrlChains"
|       SET "status_code" = 'spider:in-progress'
|       WHERE request_url = (
|         SELECT request_url
|         FROM "UrlChains"
|         WHERE "status_code" = 'status:new'
|         LIMIT 1
|       )
|      RETURNING request_url
|      `));
    return results;
  });

  // prettyPrint({ queryResults });
  const results: Array<{ request_url: string }> = queryResults as any;

  await db.close();
  const nextUrl = results.length > 0 ? results[0].request_url : undefined;
  return nextUrl;
}

export interface UrlStatus {
  request_url: string;
  response_url: string;
  status_code: string;
  status_message?: string;
}

export async function commitUrlStatus(
  dbCtx: DatabaseContext,
  requestUrl: string,
  statusCode: string,
  statusMessage: string
): Promise<void> {
  const db = await openDatabase(dbCtx.dbConfig);

  await db.run(async (sql) => {
    const esc = (s: string) => sql.escape(s);

    const query = stripMargin(`
|       UPDATE "UrlChains"
|         SET
|           "status_code" = ${esc(statusCode)},
|           "status_message" = ${esc(statusMessage)},
|           "updatedAt" = NOW()
|         WHERE
|           request_url = ${esc(requestUrl)}
`);

    const results = await sql.query(query);
    return results;
  });

  await db.close();
}

export async function getUrlStatus(
  dbCtx: DatabaseContext,
  url: string
): Promise<UrlStatus | undefined> {
  const db = await openDatabase(dbCtx.dbConfig);

  const [queryResults] = await db.run(async (sql) => {
    const esc = (s: string) => sql.escape(s);

    const query = stripMargin(`
|       SELECT  "request_url", "response_url", "status_code", "status_message"
|         FROM "UrlChains"
|         WHERE request_url = ${esc(url)}
`);

    const results = await sql.query(query);
    return results;
  });

  const response: UrlStatus[] = queryResults as any[];

  await db.close();
  return response[0];
}

export async function commitUrlFetchData(
  dbCtx: DatabaseContext,
  metadata: UrlFetchData
): Promise<UrlStatus | undefined> {
  const db = await openDatabase(dbCtx.dbConfig);

  const { requestUrl, responseUrl, status } = metadata;

  const [queryResults] = await db.run(async (sql) => {
    const esc = (s: string) => sql.escape(s);
    const httpStatus = `http:${status}`;

    const query = stripMargin(`
|       UPDATE "UrlChains"
|         SET
|           "status_code" = ${esc(httpStatus)},
|           "response_url" = ${esc(responseUrl)},
|           "updatedAt" = NOW()
|         WHERE
|           request_url = ${esc(requestUrl)}
|         RETURNING "request_url", "response_url", "status_code"
`);

    const results = await sql.query(query);
    return results;
  });

  const response: UrlStatus[] = queryResults as any[];

  await db.close();
  return response[0];
}
