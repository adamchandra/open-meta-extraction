import _ from 'lodash';

import { arglib, initConfig, putStrLn } from '@watr/commonlib';
import { formatStatusMessages, showStatusSummary } from '~/db/extraction-summary';
import { connectToMongoDB, mongoConnectionString, resetMongoDB } from '~/db/mongodb';
import { createCollections } from '~/db/schemas';
import { FetchService } from '~/components/fetch-service';
import { ExtractionService } from '~/components/extraction-service';
import { OpenReviewGateway } from '~/components/openreview-gateway';
import { runMonitor } from '~/components/monitor-service';

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
    'run-fetch-service',
    'Fetch new OpenReview URLs into local DB for spidering/extraction',
    opt.num('limit: Only fetch the specified # of notes before exiting', 0),
  )(async (args: any) => {
    const { limit } = args;
    initConfig();
    const conn = await connectToMongoDB();
    const fetchService = new FetchService();
    await fetchService.runFetchLoop(limit);
    await fetchService.close();

    await conn.connection.close();
    // await fetchService.runRelayFetch(offset, count)
    //   .finally(() => {
    //     return mongoose.connection.close();
    //   });
  });

  registerCmd(
    yargv,
    'run-monitor-service',
    'Periodically send notifications with system monitor report',
    config(
      opt.flag('send-notification'),
    )
  )(async (args: any) => {
    const { sendNotification } = args;
    await runMonitor({ sendNotification });
  });

  registerCmd(
    yargv,
    'run-extraction-service',
    'Spider new URLs, extract metadata, and POST results back to OpenReview API',
    opt.num('count', 0),
    opt.flag('post-results'),
  )(async (args: any) => {
    const { count } = args;
    const postResultsToOpenReview: boolean = args.postResults;

    initConfig();

    const extractionService = new ExtractionService();
    const mongoose = await connectToMongoDB();

    await extractionService.runRelayExtract({ count, postResultsToOpenReview })
      .finally(async () => {
        console.log('run-extraction-service: closing...');
        await mongoose.connection.close();
        return;
      });

    console.log('done! run-extraction-service');
  });

  registerCmd(
    yargv,
    'mongo-tools',
    'Create/Delete/Update Mongo Database',
    opt.flag('clean'),
  )(async (args: any) => {
    const { clean } = args;
    initConfig();
    const conn = mongoConnectionString();
    putStrLn('Mongo Tools');
    putStrLn(`Connection: ${conn}`);

    if (clean) {
      putStrLn('Cleaning Database');
      const mongoose = await connectToMongoDB();
      await resetMongoDB();
      putStrLn('Close connections');
      await mongoose.connection.close();
      putStrLn('...done');
    }
  });

  registerCmd(
    yargv,
    'openreview-api',
    'Interact with OpenReview.net REST API',
  )(async (args: any) => {
    initConfig();
    const openreviewGateway = new OpenReviewGateway();
    await openreviewGateway.testNoteFetching();
  });
}
