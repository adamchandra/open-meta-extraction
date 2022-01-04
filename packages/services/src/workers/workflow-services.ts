import _ from 'lodash';
import {
  createHubService,
  createSatelliteService,
  defineSatelliteService,
  SatelliteService,
  ServiceHub,
  SatelliteServiceDef
} from '~/service-comm/service-hub';

import { Server } from 'http';
import { promisify } from 'util';
import { startRestWorker } from '~/http-servers/extraction-rest-portal/rest-worker';
import { DatabaseContext, insertNewUrlChains } from '~/db/db-api';
import { getDBConfig } from '~/db/database';
// import { createSpiderService, SpiderService } from '~/spidering/spider-service';
// import { commitMetadata, getNextUrlForSpidering, insertCorpusEntry, insertNewUrlChains } from '~/db/db-api';
// import { putStrLn } from '@watr/commonlib';
// import { getNextUrlForSpidering, insertNewUrlChains } from '~/db/db-api';
// import { createSpiderService } from '~/workflow/spider-service';


// function getWorkingDir(): string {
//   const appSharePath = process.env['APP_SHARE_PATH'];
//   const workingDir = appSharePath ? appSharePath : 'app-share.d';
//   return workingDir;
// }

type WorkflowServiceName = keyof {
  RestPortal: null,
  UploadIngestor: null,
  Spider: null,
  FieldExtractor: null,
  FieldBundler: null,
}


export const WorkflowServiceNames: WorkflowServiceName[] = [
  'RestPortal',
  'UploadIngestor',
  'Spider',
  'FieldExtractor',
  'FieldBundler',
];
const RestPortal = defineSatelliteService<Server>(
  (serviceComm) => startRestWorker(serviceComm), {
  async shutdown() {
    this.log.debug(`${this.serviceName} [shutdown]> `)

    const server = this.cargo;
    const doClose = promisify(server.close).bind(server);
    return doClose().then(() => {
      this.log.debug(`${this.serviceName} [server:shutdown]> `)
    });
  }
});

interface UploadIngestorT {
  databaseContext: DatabaseContext,
}

// const  UploadIngestor2 = defineSatelliteService<void>(
//     async () => undefined, {
//     async run(data: WorkflowData): Promise<WorkflowData> {
//       const workingDir = getWorkingDir();
//       this.log.info(`[run]> ${data.kind}; working dir = ${workingDir}`)

//       const { alphaRec } = data;
//       // if we have the data on disk, just return it
//       const downloadDir = path.resolve(workingDir, 'downloads.d');

//       getExtractedField(downloadDir, alphaRec);
//       return data;
//     },
//   }),

const UploadIngestor = defineSatelliteService<UploadIngestorT>(
  async () => {
    const dbConfig = getDBConfig('production');
    if (dbConfig === undefined) {
      throw new Error('invalid database config; use env.{database,username,password}')
    }
    const databaseContext: DatabaseContext = { dbConfig };
    return {
      databaseContext
    };
  }, {
  async step(): Promise<void> {
    this.log.info('[step]> ')
    const { databaseContext } = this.cargo;
    await insertNewUrlChains(databaseContext)
  }
});

const Spider = defineSatelliteService<void>(
  async () => undefined, {
});
// const Spider = defineSatelliteService<SpiderService>(
//   async () => createSpiderService(getWorkingDir()), {
//   async step() {
//     this.log.info(`${this.serviceName} [step]> `)
//     const spider = this.cargo;
//     let nextUrl = await getNextUrlForSpidering();
//     while (nextUrl !== undefined) {
//       const metadata = await spider
//         .scrape(nextUrl)
//         .catch((error: Error) => {
//           putStrLn('Error', error.name, error.message);
//           return undefined;
//         });

//       if (metadata !== undefined) {
//         const committedMeta = await commitMetadata(metadata);
//         this.log.info(`committing Metadata ${committedMeta}`)
//         if (committedMeta) {
//           committedMeta.statusCode === 'http:200';
//           const corpusEntryStatus = await insertCorpusEntry(committedMeta.url);
//           this.log.info(`created new corpus entry ${corpusEntryStatus.entryId}: ${corpusEntryStatus.statusCode}`)
//           // await this.commLink.echoBack('step');
//         }
//       } else {
//         putStrLn(`Metadata is undefined for url ${nextUrl}`);
//       }
//       nextUrl = await getNextUrlForSpidering();
//     }
//   },
//   async shutdown() {
//     this.log.debug(`${this.serviceName} [shutdown]> `)
//     const spider = this.cargo;
//     return spider.scraper.quit()
//       .then(() => {
//         this.log.debug(`${this.serviceName} [scraper:shutdown]> `)
//       });
//   }
//   });

const registeredServices: Record<WorkflowServiceName, SatelliteServiceDef<any>> = {
  RestPortal,
  UploadIngestor,
  Spider,
  'FieldExtractor': defineSatelliteService<void>(
    async () => undefined, {
  }),

  'FieldBundler': defineSatelliteService<void>(
    async () => undefined, {
  }),
};

export async function runServiceHub(
  hubName: string,
  dockerize: boolean,
  orderedServices: string[]
): Promise<[ServiceHub, () => Promise<void>]> {
  if (dockerize) {
    process.env['DOCKERIZED'] = 'true';
  }
  return createHubService(hubName, orderedServices);
}

export async function runService(
  hubName: string,
  serviceName: WorkflowServiceName,
  dockerize: boolean
): Promise<SatelliteService<any>> {
  if (dockerize) {
    process.env['DOCKERIZED'] = 'true';
  }
  const serviceDef = registeredServices[serviceName]
  return createSatelliteService(hubName, serviceName, serviceDef);
}

// export interface RecordRequest {
//   kind: 'record-request';
//   alphaRec: AlphaRecord;
// }
// export const RecordRequest =
//   (alphaRec: AlphaRecord): RecordRequest => ({
//     kind: 'record-request',
//     alphaRec
//   });

// export interface FieldResponse {
//   kind: 'field-response';
//   alphaRec: AlphaRecord;
// }

// export type WorkflowData =
//   RecordRequest
//   ;

// function getWorkingDir(): string {
//   const appSharePath = process.env['APP_SHARE_PATH'];
//   const workingDir = appSharePath ? appSharePath : 'app-share.d';
//   return workingDir;
// }

// const registeredServices: Record<WorkflowServiceName, SatelliteServiceDef<any>> = {


//   'Spider': defineSatelliteService<SpiderService>(
//     async () => createSpiderService(getWorkingDir()), {
//     async run(data: WorkflowData): Promise<WorkflowData> {
//       this.log.info(`[run]> ${data.kind}`)
//       const { alphaRec } = data;
//       const spider = this.cargo;
//       const nextUrl = alphaRec.url;

//       const metadata = await spider
//         .scrape(nextUrl)
//         .catch((error: Error) => {
//           putStrLn('Error', error.name, error.message);
//           return undefined;
//         });

//       // return metadata;

//       return data;
//     },

//     async shutdown() {
//       this.log.debug(`${this.serviceName} [shutdown]> `)
//       const spider = this.cargo;
//       return spider.scraper.quit()
//         .then(() => {
//           this.log.debug(`${this.serviceName} [scraper:shutdown]> `)
//         });
//     }
//   }),


//   'FieldExtractor': defineSatelliteService<void>(
//     async () => undefined, {
//     async run(data: WorkflowData): Promise<WorkflowData> {
//       this.log.info(`[run]> ${data.kind}`)
//       const { alphaRec } = data;
//       const { url } = alphaRec;

//       const workingDir = getWorkingDir();
//       const corpusRoot = path.resolve(workingDir, 'downloads.d');
//       const entryEncPath = makeHashEncodedPath(url, 3);
//       const entryPath = entryEncPath.toPath();
//       const entryFullpath = path.resolve(corpusRoot, entryPath);
//       await extractFieldsForEntry(entryFullpath, this.log)
//       return data;
//     },
//   }),

//   'FieldBundler': defineSatelliteService<void>(
//     async () => undefined, {
//     async run(data: WorkflowData): Promise<WorkflowData> {
//       this.log.info(`[run]> ${data.kind}`)

//       const workingDir = getWorkingDir();
//       const corpusRoot = path.resolve(workingDir, 'downloads.d');

//       this.log.info(`[run]> ${data.kind}; working dir = ${corpusRoot}`)

//       const { alphaRec } = data;
//       // if we have the data on disk, just return it
//       getExtractedField(corpusRoot, alphaRec);

//       return data;
//     },
//   }),
// };
