import _ from 'lodash';
import { getCorpusEntryDirForUrl, prettyPrint, AlphaRecord, setEnv } from '@watr/commonlib';
import fs from 'fs-extra';
import Async from 'async';
import { Server } from 'http';
import { fetchOneRecord, WorkflowServices } from './workflow-services';

// import { createSpiderService } from '~/spidering/spider-service';
import { getBasicConsoleLogger  } from '@watr/commonlib';
import { createSpiderService } from './spider-service';
import { startSpiderableTestServer } from '~/http-servers/extraction-rest-portal/mock-server';
import { getDBConfig } from '~/db/database';
import { DatabaseContext } from '~/db/db-api';
import { createEmptyDB } from '~/db/db-test-utils';
import { extractFieldsForEntry } from '@watr/field-extractors';

describe('End-to-end Extraction workflows', () => {
  function mockAlphaRecord(n: number, urlPath: string): AlphaRecord {
    return ({
      noteId: `note-id-${n}`,
      dblpConfId: `dblp/conf/conf-${n}`, // TODO rename to dblpKey
      title: `The Title Paper #${n}`,
      authorId: `auth-${n}`,
      url: `http://localhost:9100${urlPath}`
    });
  }

  const workingDir = './test.scratch.d';
  setEnv('AppSharePath', workingDir);
  setEnv('DBPassword', 'watrpasswd');
  const dbConfig = getDBConfig('test');
  const dbCtx: DatabaseContext | undefined = dbConfig ? { dbConfig } : undefined;
  expect(dbCtx).toBeDefined;
  if (dbConfig === undefined || dbCtx === undefined) return;

  let server: Server | undefined;

  beforeEach(async () => {
    fs.emptyDirSync(workingDir);
    fs.removeSync(workingDir);
    fs.mkdirSync(workingDir);
    return startSpiderableTestServer()
      .then(s => {
        server = s;
      })
      .then(() => createEmptyDB(dbConfig))
      .then((db) => db.close());
  });


  afterEach(() => {
    return new Promise<void>((resolve) => {
      if (server !== undefined) {
        server.close(() => resolve());
      }
    });
  });


  it('should fetch alpha records', async () => {
    const log = getBasicConsoleLogger('debug');

    const spiderService = await createSpiderService(log);

    const workflowServices: WorkflowServices = {
      spiderService,
      log,
      dbCtx
    };
    const exampleUrls = [
      '/200~withFields',
      // '/200~withoutFields',
      // '/404~custom404~100',
      // '/404~custom404',
    ];

    await Async.eachOfSeries(exampleUrls, Async.asyncify(async (url: string, exampleNumber: number) => {
      const alphaRec = mockAlphaRecord(1, url);
      const fetchedRecord = await fetchOneRecord(dbCtx, workflowServices, alphaRec);
      prettyPrint({ exampleNumber, fetchedRecord });
    }));

    console.log('quitting..');

    await spiderService.quit();
    console.log('...quit');
  });

  it('should update database if fields are extracted but no db entry exists', async () => {
    const log = getBasicConsoleLogger('debug');

    const spiderService = await createSpiderService(log);

    const workflowServices: WorkflowServices = {
      spiderService,
      log,
      dbCtx
    };
    const exampleUrls = [
      '/200~withFields',
    ];

    await Async.eachOfSeries(exampleUrls, Async.asyncify(async (_url: string, exampleNumber: number) => {
      const alphaRec = mockAlphaRecord(1, _url);
      const { url } = alphaRec;
      await spiderService
        .scrape(url)
        .catch((error: Error) => {
          return `${error.name}: ${error.message}`;
        });

      const entryPath = getCorpusEntryDirForUrl(url);
      await extractFieldsForEntry(entryPath, log);

      const fetchedRecord = await fetchOneRecord(dbCtx, workflowServices, alphaRec);
      prettyPrint({ exampleNumber, fetchedRecord });
    }));

    await spiderService.quit();
  });
});
