import _ from 'lodash';


import { arglib, initConfig, putStrLn } from '@watr/commonlib';
import { formatStatusMessages, showStatusSummary } from '~/db/extraction-summary';
import { connectToMongoDB, mongoConnectionString, resetMongoDB } from '~/db/mongodb';
import { createFetchService } from '~/components/fetch-service';
import { createExtractionService } from '~/components/extraction-service';
import { OpenReviewGateway } from '~/components/openreview-gateway';
import { runMonitor } from '~/components/monitor-service';
import { CursorRoles, createMongoQueries, isCursorRole } from '~/db/query-api';


const { opt, config, registerCmd } = arglib;


export function registerCLICommands(yargv: arglib.YArgsT) {
  registerCmd(
    yargv,
    'extraction-summary',
    'Show A Summary of Spidering/Extraction Progress',
    config(
    )
  )(async () => {
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
    const fetchService = await createFetchService();
    await fetchService.runFetchLoop(limit);
    await fetchService.close();
  });

  registerCmd(
    yargv,
    'update-cursor',
    'Create/update/delete pointers to last fetched/extracted',
    config(
      opt.str('delete: delete the named cursor', undefined),
    )
  )(async (args: any) => {
    const del = args.delete;

    const mdb = await createMongoQueries();

    if (isCursorRole(del)) {
      const didDelete = await mdb.deleteCursor(del);
      const msg = didDelete? 'deleted' : 'not deleted';
      putStrLn(`Cursor was ${msg}`);
    } else {
      putStrLn(`Not a valid cursor role: ${del}`)
      const r = CursorRoles.join(', ')
      putStrLn(`Roles are: ${r}`)
    }

    await mdb.close();
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
    opt.num('limit: Only extract the specified # of notes before exiting', 0),
    opt.flag('post-results'),
  )(async (args: any) => {
    const postResultsToOpenReview: boolean = args.postResults;
    const limit: number = args.limit;

    const extractionService = await createExtractionService();

    await extractionService.runExtractionLoop({ limit, postResultsToOpenReview });

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
  )(async () => {
    initConfig();
    const openreviewGateway = new OpenReviewGateway();
    await openreviewGateway.testNoteFetching();
  });
}
