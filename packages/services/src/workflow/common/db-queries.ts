import { DatabaseContext, insertAlphaRecords } from '~/db/db-api';

import {
  streamPump,
  putStrLn,
  AlphaRecord,
  readAlphaRecStream
} from '@watr/commonlib';

export async function insertNewAlphaRecords(
  dbCtx: DatabaseContext,
  alphaRecordCsv: string,
): Promise<void> {
  const inputStream = readAlphaRecStream(alphaRecordCsv);

  putStrLn('Reading CSV Records...');
  const alphaRecords = await streamPump.createPump()
    .viaStream<AlphaRecord>(inputStream)
    .gather()
    .toPromise();

  if (alphaRecords === undefined) {
    putStrLn(`No records found in CSV ${alphaRecordCsv}`);
    return;
  }

  putStrLn(`Inserting ${alphaRecords.length} Records`);
  const newRecs = await insertAlphaRecords(dbCtx, alphaRecords);
  const len = newRecs.length;
  putStrLn(`Inserted ${len} new records`);
}
