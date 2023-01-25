import _ from 'lodash';
import { startSpiderableTestServer } from './test-http-server';

import fs from 'fs-extra';
import { Server } from 'http';
// import axios from 'axios';
import { setLogEnvLevel } from '@watr/commonlib';

describe('REST Worker Endpoints', () => {
  setLogEnvLevel('info');
  const workingDir = './test.scratch.d';

  let testServer: Server | undefined;

  beforeEach(async () => {
    fs.emptyDirSync(workingDir);
    fs.removeSync(workingDir);
    fs.mkdirSync(workingDir);
    return startSpiderableTestServer()
      .then(async (server) => {
        testServer = server;
      });
  });

  afterEach(async () => {
    const pClose1 = new Promise((resolve) => {
      if (testServer === undefined) return;
      testServer.on('close', () => resolve(undefined));
      testServer.close();
    });
    return pClose1;
  });

  it('should run end-to-end', async () => {
    // const url = `http://localhost:9100/200~withFields`;
    // const retval = await axios.post(
    //   'http://localhost:3100/extractor/url',
    // );
    // const response = retval.data;
    // // prettyPrint({ response });
  });
});
