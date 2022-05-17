import _ from 'lodash';
import fs from 'fs-extra';
import { Server } from 'http';

import { defineServiceHub } from '@watr/commlinks';

import { runServiceHubAndSatellites } from '../common/testing-utils';
import { SpiderService } from './spider-service';
import { startSpiderableTestServer } from '~/http-servers/rest-portal/mock-server';
// import { OpenReviewRelayService } from './openreview-relay';
import { setLogEnvLevel } from '@watr/commonlib';

describe('End-to-end Distributed Extraction workflows', () => {
  setLogEnvLevel('debug');
  const workingDir = './test.scratch.d';

  let server: Server | undefined;
  beforeEach(async () => {
    fs.emptyDirSync(workingDir);
    fs.removeSync(workingDir);
    fs.mkdirSync(workingDir);
    return startSpiderableTestServer()
      .then(s => {
        server = s;
      })
      // .then(() => createEmptyDB(dbConfig))
      // .then((db) => db.close());
  });


  afterEach(() => {
    return new Promise<void>((resolve) => {
      if (server !== undefined) {
        server.close(() => resolve());
      }
    });
  });


  // it('should run end-to-end', async () => {
  //   const serviceChainWorkers = [
  //     SpiderService,
  //     OpenReviewRelayService
  //   ];
  //   const orderedServices = serviceChainWorkers.map(w => w.name);

  //   const hubDef = defineServiceHub('HubService', orderedServices, [], {});

  //   const [hubService, hubConnected] =
  //     await runServiceHubAndSatellites(hubDef, serviceChainWorkers);

  //   await hubConnected();

  //   await hubService.shutdownSatellites();
  //   await hubService.commLink.quit();
  // });
});
