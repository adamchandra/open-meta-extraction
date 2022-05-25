import _ from 'lodash';

import { arglib, initConfig, putStrLn } from '@watr/commonlib';
import { runRelayExtract, runRelayFetch } from './distributed/openreview-relay';
import { formatStatusMessages, showStatusSummary } from '~/db/extraction-summary';
import { connectToMongoDB, mongoConnectionString } from '~/db/mongodb';
import { createCollections } from '~/db/schemas';
const { opt, config, registerCmd } = arglib;

export function registerCLICommands(yargv: arglib.YArgsT) {
  registerCmd(
    yargv,
    'extraction-summary',
    'Show A Summary of Spidering/Extraction Progress',
    config(
    )
  )(async (args: any) => {
    putStrLn('Extraction Summary');
    initConfig();
    const mongoose = await connectToMongoDB();
    const summaryMessages = await showStatusSummary();
    const formatted = formatStatusMessages(summaryMessages);
    putStrLn(formatted);
    await mongoose.connection.close();
  });

  registerCmd(
    yargv,
    'run-relay-fetch',
    'Fetch OpenReview Notes into local DB for spidering/extraction',
    opt.num('offset', 0),
    opt.num('count', Number.MAX_SAFE_INTEGER),
  )(async (args: any) => {
    const offset: number = args.offset;
    const count: number = args.count;
    initConfig();
    const mongoose = await connectToMongoDB();

    await runRelayFetch(offset, count)
      .finally(() => {
        return mongoose.connection.close();
      });
  });

  registerCmd(
    yargv,
    'run-relay-extract',
    'Fetch OpenReview Notes into local DB for spidering/extraction',
    opt.num('count', 0),
  )(async (args: any) => {
    const count: number = args.count;
    initConfig();
    const mongoose = await connectToMongoDB();

    await runRelayExtract(count)
      .finally(() => {
        console.log('run-relay-extract: closing...');
        return mongoose.connection.close();
      });
    console.log('done! run-relay-extract');
  });

  registerCmd(
    yargv,
    'mongo-tools',
    'Create/Delete/Update Mongo Database',
    opt.flag('clean'),
  )(async (args: any) => {
    const clean: boolean = args.clean;
    initConfig();
    const conn = mongoConnectionString();
    putStrLn('Mongo Tools');
    putStrLn(`Connection: ${conn}`);

    if (clean) {
      putStrLn('Cleaning Database');
      const mongoose = await connectToMongoDB();
      putStrLn('dropDatabase..');
      await mongoose.connection.dropDatabase();
      putStrLn('createCollections..');
      await createCollections();
      putStrLn('Close connections');
      await mongoose.connection.close();
      putStrLn('...done');
    }
  });

}
