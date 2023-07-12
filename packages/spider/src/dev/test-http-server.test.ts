import _ from 'lodash';
import { respondWith, isGETEqual, withServer } from './test-http-server';

import axios from 'axios';
import { setLogEnvLevel } from '@watr/commonlib';

describe('REST Worker Endpoints', () => {
  setLogEnvLevel('info');
  const workingDir = './test.scratch.d';

  // let testServer: Server | undefined;

  beforeAll(async () => {
    // testServer = await resetTestServer(workingDir);
    // putStrLn('test server started');
  });

  afterAll(async () => {
    // return closeTestServer(testServer);
  });

  it('should smokescreen run', async () => {
    const url = `http://localhost:9100/echo?foo=bar`;
    const retval = await axios.get(url);
    const response = retval.data;
    expect(response).toMatchObject({ foo: 'bar' })
  });


  it('should use withServer() and properly shutdown', async () => {
    await withServer((r) => {
      r.get('/bar', respondWith({ bar: 'foo' }))
      r.get('/foo', respondWith({ foo: 'bar' }))
    }, async () => {
      await isGETEqual('http://localhost:9100/foo', { foo: 'bar' })
      await isGETEqual('http://localhost:9100/bar', { bar: 'foo' })
    });
  });

  // it('should put/post/get/etc from internal json db', async () => {
  //   const url = `http://localhost:9100/notes?id=1`;
  //   const retval = await axios.get(url);
  // });

  // it('should allow custom path functions', async () => {
  //   const url = `http://localhost:9100/notes?id=1`;
  //   const retval = await axios.get(url);
  // });
});
