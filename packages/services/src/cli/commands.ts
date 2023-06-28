import _ from 'lodash';

import { arglib, initConfig, prettyPrint, putStrLn } from '@watr/commonlib';
import { formatStatusMessages, showStatusSummary } from '~/db/extraction-summary';
import { connectToMongoDB, mongoConnectionString } from '~/db/mongodb';
import { createCollections } from '~/db/schemas';
import { FetchService } from '~/components/fetch-service';
import { ExtractionService } from '~/components/extraction-service';
import { OpenReviewExchange } from '~/components/openreview-exchange';
import { Notes } from '~/components/openreview-gateway';
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
    opt.num('offset', 0),
    opt.num('count', Number.MAX_SAFE_INTEGER),
  )(async (args: any) => {
    const offset: number = args.offset;
    const count: number = args.count;
    initConfig();
    const mongoose = await connectToMongoDB();
    const fetchService = new FetchService();

    await fetchService.runRelayFetch(offset, count)
      .finally(() => {
        return mongoose.connection.close();
      });
  });

  registerCmd(
    yargv,
    'run-monitor-service',
    'Periodically send notifications with system monitor report',
    config(
      opt.flag('send-notification'),
    )
  )(async (args: any) => {
    const sendNotification: boolean = args.sendNotification;
    await runMonitor({ sendNotification });
  });

  registerCmd(
    yargv,
    'run-extraction-service',
    'Spider new URLs, extract metadata, and POST results back to OpenReview API',
    opt.num('count', 0),
    opt.flag('post-results'),
  )(async (args: any) => {
    const count: number = args.count;
    const postResultsToOpenReview: boolean = args.postResults;

    initConfig();

    const extractionService = new ExtractionService();
    const mongoose = await connectToMongoDB();

    await extractionService.runRelayExtract({ count, postResultsToOpenReview })
      .finally(() => {
        console.log('run-extraction-service: closing...');
        return mongoose.connection.close();
      });

    console.log('done! run-extraction-service');
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

  registerCmd(
    yargv,
    'openreview-api',
    'Interact with OpenReview.net REST API',
  )(async (args: any) => {
    initConfig();
    const oex = new OpenReviewExchange()
    const minDate = 0;

    const notes = await oex.apiGET<Notes>('/notes',
      {
        invitation: 'dblp.org/-/record',
        mintcdate: minDate,
        sort: 'tcdate:asc'
      });
    if (notes) {
      putStrLn(`Note Count = ${notes.count}`)
      if (notes.count > 0) {
        const note = notes.notes[0];
        prettyPrint({ note })
        const noteN = notes.notes[notes.notes.length - 1];
        prettyPrint({ noteN })
      }
    }

  });
}
