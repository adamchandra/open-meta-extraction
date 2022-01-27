import _ from 'lodash';
import { prettyPrint } from '@watr/commonlib';
import fs from 'fs-extra';
import Async from 'async';
import { Server } from 'http';
import { runServicesInlineNoDB,  WorkflowServices } from './inline-workflow';
import { createSpiderService } from '~/workflow/distributed/spider-worker';

import { getServiceLogger } from '@watr/commonlib';
import { startSpiderableTestServer } from '~/http-servers/rest-portal/mock-server';
import { mockAlphaRecord } from '@watr/spider';

describe('End-to-end Extraction workflows', () => {
  const workingDir = './test.scratch.d';

  let server: Server | undefined;

  beforeEach(async () => {
    fs.emptyDirSync(workingDir);
    fs.removeSync(workingDir);
    fs.mkdirSync(workingDir);
    return startSpiderableTestServer()
      .then(s => {server = s;});
  });


  afterEach(() => {
    return new Promise<void>((resolve) => {
      if (server !== undefined) {
        server.close(() => resolve());
      }
    });
  });


  it('should fetch alpha records', async () => {
    const log = getServiceLogger('test-service');

    const spiderService = await createSpiderService(log);

    const workflowServices: WorkflowServices = {
      spiderService,
      log,
      dbCtx: undefined
    };

    const exampleUrls = [
      '/200~withFields',
      // '/200~withoutFields',
      // '/404~custom404~100',
      // '/404~custom404',
    ];

    await Async.eachOfSeries(exampleUrls, Async.asyncify(async (urlPath: string, exampleNumber: number) => {
      const url = `http://localhost:9100${urlPath}`
      const alphaRec = mockAlphaRecord(1, url);
      const fetchedRecord = await runServicesInlineNoDB(workflowServices, alphaRec);
      prettyPrint({ exampleNumber, fetchedRecord });
    }));


    await spiderService.quit();
  });

});
