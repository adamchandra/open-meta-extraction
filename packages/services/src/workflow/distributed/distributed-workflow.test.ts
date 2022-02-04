import _ from 'lodash';
import { AlphaRecord, initConfig, prettyPrint } from '@watr/commonlib';
import { defineServiceHub } from '@watr/commlinks';
import { runServiceHubAndSatellites } from './distributed-workflow';
import { UploadIngestor, FieldExtractor, RestPortalService } from './workers';
import { Spider } from './spider-worker';
import { startSpiderableTestServer } from '~/http-servers/rest-portal/mock-server';
import fs from 'fs-extra';
import { Server } from 'http';
import { mockAlphaRecord } from '@watr/spider';
import axios from 'axios';


describe('End-to-end Extraction workflows', () => {
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
    // const conf = initConfig();
    // prettyPrint({ conf });

    const serviceChainWorkers = [
      RestPortalService,
      UploadIngestor,
      Spider,
      FieldExtractor,
    ];
    const orderedServices = serviceChainWorkers.map(w => w.name);

    const hubDef = defineServiceHub('HubService', orderedServices, [], {});

    const [hubService, hubConnected, satelliteRecords] =
      await runServiceHubAndSatellites(hubDef, serviceChainWorkers);

    await hubConnected();

    const url = `http://localhost:9100/200~withFields`;
    const alphaRec = mockAlphaRecord(1, url);
    const retval = await axios.post(
      'http://localhost:3100/extractor/record.json',
      alphaRec
    );

    const returnData = retval.data;
    prettyPrint({ returnData });

    await hubService.shutdownSatellites();
    await hubService.commLink.quit();
  });

});
