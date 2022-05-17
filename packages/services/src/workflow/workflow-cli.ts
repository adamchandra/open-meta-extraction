import _ from 'lodash';

import { createSatelliteService, createServiceHub, defineServiceHub } from '@watr/commlinks';
import { arglib, initConfig, putStrLn } from '@watr/commonlib';
import { SpiderService } from './distributed/spider-service';
// import { OpenReviewRelayService, runOpenReviewRelay, runRelayFetch } from './distributed/openreview-relay';
import { runRelayExtract, runRelayFetch } from './distributed/openreview-relay';
import { sigtraps } from '~/util/shutdown';
import { formatStatusMessages, showStatusSummary } from '~/db/extraction-summary';
import { connectToMongoDB, mongoConnectionString } from '~/db/mongodb';
import { createCollections } from '~/db/schemas';
const { opt, config, registerCmd } = arglib;

export function registerCLICommands(yargv: arglib.YArgsT) {
  // const availableServices = {
  //   SpiderService,
  //   OpenReviewRelayService
  // };
  // const orderedServices = _.keys(availableServices);
  // const HubService = defineServiceHub('HubService', orderedServices, [], {});

  // registerCmd(
  //   yargv,
  //   'start-service',
  //   'start a named service',
  //   config(
  //     opt.ion('service-name: name of service to launch (or "HubService" to start hub)', {
  //       choices: _.concat(orderedServices, [HubService.name])
  //     })
  //   )
  // )((args: any) => {
  //   const { serviceName } = args;
  //   if (orderedServices.includes(serviceName)) {
  //     const serviceDef = _.get(availableServices, serviceName);
  //     return createSatelliteService(HubService.name, serviceDef)
  //       .then((service) => sigtraps(() => {
  //         return service.commLink.quit();
  //       }))
  //       .catch(error => {
  //         console.log(`Error: ${error}`)
  //       });
  //   }
  //   if (serviceName === HubService.name) {
  //     return createServiceHub(HubService)
  //       .then(([hubService, hubConnected]) => {
  //         return hubConnected()
  //           .then(() => sigtraps(async () => {
  //             await hubService.shutdownSatellites();
  //             await hubService.commLink.quit();
  //           }));
  //       })
  //       .catch(error => {
  //         console.log(`Error: ${error}`)
  //       });
  //   }
  // });

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
    opt.num('count', Number.MAX_SAFE_INTEGER),
  )(async (args: any) => {
    const count: number = args.count;
    initConfig();
    const mongoose = await connectToMongoDB();

    await runRelayExtract(count)
      .finally(() => {
        return mongoose.connection.close();
      });
  });

  registerCmd(
    yargv,
    'mongo-tools',
    'Create/Delete/Update Mongo Database',
    opt.flag('clean'),
  )(async (args: any) => {
    const clean: boolean = args.clean;
    initConfig();
    const conn = mongoConnectionString()
    putStrLn('Mongo Tools')
    putStrLn(`Connection: ${conn}`)

    if (clean) {
      putStrLn('Cleaning Database')
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
