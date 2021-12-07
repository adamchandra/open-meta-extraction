import { arglib, putStrLn } from '@watr/commonlib';
import { getDBConfig } from '~/db/database';
import { DatabaseContext, insertNewUrlChains } from '~/db/db-api';
import { runMainBundleExtractedFields } from '~/extract/run-main';
import { insertNewAlphaRecords } from './spider-service';
import { fetchAllDBRecords } from './workflow-services';

const { opt, config, registerCmd } = arglib;

registerCmd(
  arglib.YArgs,
  'insert-alpha-records',
  'Insert new Alpha Records (as CSV) into database',
  config(
    opt.cwd,
    opt.existingFile('alpha-recs: csv file with alpha records')
  )
)(async (args: any) => {
  const { alphaRecs } = args;
  const dbConfig = getDBConfig('production');
  if (dbConfig === undefined) {
    putStrLn('invalid database config; use env.{database,username,password}');
    return;
  }

  const dbCtx: DatabaseContext = { dbConfig };

  putStrLn(`importing alphaRecs from ${alphaRecs}`);

  await insertNewAlphaRecords(dbCtx, alphaRecs);

  putStrLn('Updated UrlChains for Spidering');
  await insertNewUrlChains(dbCtx);

  putStrLn('Done');
});

registerCmd(
  arglib.YArgs,
  'spider-new-alpha-records',
  'Run spider against new UrlChain records',
  config(
    opt.ion('take', {
      type: 'number',
      required: false,
      default: 0
    }),
  )
)(async (args: any) => {
  const { take } = args;
  const maxToTake: number = take;
  const dbConfig = getDBConfig('production');
  if (dbConfig === undefined) {
    putStrLn('invalid database config; use env.{database,username,password}');
    return;
  }

  const dbCtx: DatabaseContext = { dbConfig };

  const isDone = await fetchAllDBRecords(dbCtx, maxToTake);
  putStrLn(`Done=${isDone}`);
});

registerCmd(
  arglib.YArgs,
  'bundle-alpha-records',
  'Collect extracted fields for entries in CSV',
  config(
    opt.existingDir('corpus-root: root directory for corpus files'),
    opt.existingFile('alpha-recs: csv file with alpha records')
  )
)(async (args: any) => {
  const { alphaRecs, corpusRoot } = args;
  putStrLn(`Bundling extracted fields from ${alphaRecs}`);
  putStrLn(`Corpus Root is ${corpusRoot}`);

  await runMainBundleExtractedFields(corpusRoot, alphaRecs);
});
