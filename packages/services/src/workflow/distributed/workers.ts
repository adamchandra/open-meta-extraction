import { promisify } from 'util';
import { RestPortal, startRestWorker } from '~/http-servers/rest-portal/rest-worker';
import { DatabaseContext } from '~/db/db-api';
import { getDBConfig } from '~/db/database';

import {
  defineSatelliteService,
  SatelliteServiceDef
} from '@watr/commlinks';

import { WorkflowData, WorkflowServiceName } from './workflow-defs';
import { createSpiderService, SpiderService } from './spider-worker';
import { getCanonicalFieldRecs } from '~/workflow/inline/inline-workflow';

export const RestPortalService = defineSatelliteService<RestPortal>(
  'RestPortal',
  (commLink) => startRestWorker(commLink), {
  async startup() {
    // TODO move server start from init (above) to here
  },
  async runOneAlphaRec(arg: WorkflowData): Promise<WorkflowData> {
    return arg;
  },
  async runOneAlphaRecNoDB(arg: WorkflowData): Promise<WorkflowData> {
    return arg;
  },

  async shutdown() {
    this.log.debug(`${this.serviceName} [shutdown]> `)

    const { server } = this.cargo;
    const doClose = promisify(server.close).bind(server);
    return doClose().then(() => {
      this.log.debug(`${this.serviceName} [server:shutdown]> `)
    });
  }
});

export interface UploadIngestorT {
  databaseContext: DatabaseContext,
}

// TODO split out the file system parts (ArtifactService)?
export const UploadIngestor = defineSatelliteService<UploadIngestorT>(
  'UploadIngestor',
  async () => {
    // TODO ensure we have access to local filesystem and database
    const dbConfig = getDBConfig();
    if (dbConfig === undefined) {
      throw new Error('invalid database config; use env.{database,username,password}')
    }
    const databaseContext: DatabaseContext = { dbConfig };
    return {
      databaseContext
    };
  }, {

  async runOneAlphaRec(arg: WorkflowData): Promise<WorkflowData> {
    // insertNewUrlChains(databaseContext)
    return arg;
  },
  async runOneAlphaRecNoDB(arg: WorkflowData): Promise<WorkflowData> {
    const { alphaRec } = arg;
    const { url } = alphaRec;

    this.log.info(`Fetching fields for ${url}`);

    // First attempt: if we have the data on disk, just return it
    let fieldRecs = getCanonicalFieldRecs(alphaRec);

    if (fieldRecs === undefined) {
      // Try to spider/extract
      this.log.info(`No extracted fields found.. spidering ${url}`);

      // const metadataOrError = await scrapeUrlNoDB(services, url);
      // if ('error' in metadataOrError) {
      //   return metadataOrError;
      // }

    //   const entryPath = getCorpusEntryDirForUrl(url);

    //   log.info(`Extracting Fields in ${entryPath}`);

    //   await extractFieldsForEntry(entryPath, log);

    //   // try again:
    //   fieldRecs = getCanonicalFieldRecs(alphaRec);
    }

    // if (fieldRecs === undefined) {
    //   const msg = 'No extracted fields available';
    //   log.info(msg);
    //   return ErrorRecord(msg);
    // }

    // return fieldRecs;


    return arg;
  },
});


export const FieldExtractor = defineSatelliteService<void>(
  'FieldExtractor',
  async () => undefined, {
  async runOneAlphaRecNoDB(arg: WorkflowData): Promise<WorkflowData> {
    // this.log.info(`[run]> ${data.kind}`)
    // const { alphaRec } = data;
    // const { url } = alphaRec;

    // const workingDir = getWorkingDir();
    // const corpusRoot = path.resolve(workingDir, 'downloads.d');
    // const entryEncPath = makeHashEncodedPath(url, 3);
    // const entryPath = entryEncPath.toPath();
    // const entryFullpath = path.resolve(corpusRoot, entryPath);
    // await extractFieldsForEntry(entryFullpath, this.log)
    // return data;
    return arg;
  },
});

export const FieldBundler = defineSatelliteService<void>(
  'FieldBundler',
  async () => undefined, {
  async runOneAlphaRecNoDB(arg: WorkflowData): Promise<WorkflowData> {
    // this.log.info(`[run]> ${data.kind}`)
    // const workingDir = getWorkingDir();
    // const corpusRoot = path.resolve(workingDir, 'downloads.d');
    // this.log.info(`[run]> ${data.kind}; working dir = ${corpusRoot}`)
    // const { alphaRec } = data;
    // // if we have the data on disk, just return it
    // getExtractedField(corpusRoot, alphaRec);
    // return data;
    return arg;
  },
});

// TODO remove this
export const registeredServices: Partial<Record<WorkflowServiceName, SatelliteServiceDef<any>>> = {
};
