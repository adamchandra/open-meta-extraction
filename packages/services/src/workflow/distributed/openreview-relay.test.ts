import _ from 'lodash';
import { initConfig, prettyPrint } from '@watr/commonlib';
import { defineServiceHub } from '@watr/commlinks';
import { runServiceHubAndSatellites } from './distributed-workflow';
import { WorkflowConductor, FieldExtractor, RestService } from './workers';
import { SpiderService } from './spider-worker';
import { startSpiderableTestServer } from '~/http-servers/rest-portal/mock-server';
import fs from 'fs-extra';
import { Server } from 'http';
import { OpenReviewRelayService } from './openreview-relay';

describe('End-to-end Distributed Extraction workflows', () => {
  process.env['service-comm.loglevel'] = 'info';
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


  it('should run end-to-end', async () => {
    const serviceChainWorkers = [
      WorkflowConductor,
      SpiderService,
      FieldExtractor,
      OpenReviewRelayService
    ];
    const orderedServices = serviceChainWorkers.map(w => w.name);

    const hubDef = defineServiceHub('HubService', orderedServices, [], {});

    const [hubService, hubConnected] =
      await runServiceHubAndSatellites(hubDef, serviceChainWorkers);

    await hubConnected();

    await hubService.shutdownSatellites();
    await hubService.commLink.quit();
  });
});
