import _ from 'lodash';
import fs from 'fs-extra';
import { Server } from 'http';

import { newCommLink, SatelliteService } from '@watr/commlinks';
import { createSpiderService, SpiderService } from './spider-service';
import { startSpiderableTestServer } from '~/http-servers/rest-portal/mock-server';
import { prettyPrint, putStrLn, setLogEnvLevel } from '@watr/commonlib';

describe('Spider/Field Extractor Service', () => {
  setLogEnvLevel('debug');
  const workingDir = './test.scratch.d';

  let server: Server | undefined;
  beforeEach((done) => {
    putStrLn(`beforeEach: begin`)
    fs.emptyDirSync(workingDir);
    fs.removeSync(workingDir);
    fs.mkdirSync(workingDir);
    startSpiderableTestServer()
      .then(s => {
        server = s;
        done()
      });
  });


  afterEach(() => {
    return new Promise<void>((resolve) => {
      if (server !== undefined) {
        putStrLn('Closing spiderable server')
        server.close(() => resolve());
        putStrLn('...Closed')
      }
    });
  });


  it('should scrape and extract a URL', async () => {
    const url = `http://localhost:9100/htmls/200~withFields`;
    const commLink = newCommLink<SatelliteService<SpiderService>>("SpiderService");
    const spiderService = await createSpiderService(commLink);
    const res = await spiderService.scrape(url);
    prettyPrint({ res });
    await spiderService.quit()
    await commLink.quit()
  });
});
