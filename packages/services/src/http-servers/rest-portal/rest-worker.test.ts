import _ from 'lodash';
import { startSpiderableTestServer } from '~/http-servers/rest-portal/mock-server';
import fs from 'fs-extra';
import { Server } from 'http';
import { mockAlphaRecord } from '@watr/spider';
import axios from 'axios';
import { createRestServer, RestPortal } from './rest-worker';

describe('REST Worker Endpoints', () => {
  process.env['service-comm.loglevel'] = 'info';
  const workingDir = './test.scratch.d';

  let restPortal: RestPortal | undefined;
  let testServer: Server | undefined;

  beforeEach(async () => {
    fs.emptyDirSync(workingDir);
    fs.removeSync(workingDir);
    fs.mkdirSync(workingDir);
    return startSpiderableTestServer()
      .then(async (server) => {
        testServer = server;
        restPortal = await createRestServer();
        return restPortal.run();
      });
  });

  afterEach(async () => {
    const pClose1 = new Promise((resolve) => {
      testServer.on('close', () => resolve(undefined));
      testServer.close();
    });
    return pClose1.then(() => restPortal.close())
  });

  it('should run end-to-end', async () => {
    const url = `http://localhost:9100/200~withFields`;
    const alphaRec = mockAlphaRecord(1, url);
    const retval = await axios.post(
      'http://localhost:3100/extractor/url',
      alphaRec
    );
    const response = retval.data;
    // prettyPrint({ response });
  });
});
