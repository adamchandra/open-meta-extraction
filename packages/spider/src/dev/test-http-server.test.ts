import _ from 'lodash';
import { closeTestServer, resetTestServer } from './test-http-server';

import { Server } from 'http';
import axios from 'axios';
import { putStrLn, setLogEnvLevel } from '@watr/commonlib';

describe('REST Worker Endpoints', () => {
  setLogEnvLevel('info');
  const workingDir = './test.scratch.d';

  let testServer: Server | undefined;

  beforeAll(async () => {
    testServer = await resetTestServer(workingDir);
    putStrLn('test server started');
  });

  afterAll(async () => {
    return closeTestServer(testServer);
  });

  it('should smokescreen run', async () => {
    const url = `http://localhost:9100/echo?foo=bar`;
    const retval = await axios.get(url);
    const response = retval.data;
    expect(response).toMatchObject({foo: 'bar'})
  });
});
