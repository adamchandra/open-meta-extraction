import _ from 'lodash';

import {
  CommLink,
  CustomHandler,
  defineSatelliteService,
  SatelliteService
} from '@watr/commlinks';

import { getCanonicalFieldRecsForURL } from '~/workflow/inline/inline-workflow';
import { BrowserPool, createBrowserPool, UrlFetchData } from '@watr/spider';
import { getCorpusEntryDirForUrl } from '@watr/commonlib';
import {
  extractFieldsForEntry,
  initExtractionEnv,
  readUrlFetchData,
  CanonicalFieldRecords,
  ExtractionErrors,
  ExtractionSharedEnv
} from '@watr/field-extractors';


import { URLRequest, WorkflowData } from '../common/datatypes';

import { Logger } from 'winston';
import { SpiderService } from './spider-worker';

export interface WorkflowConductorT {
  log: Logger;
  commLink: CommLink<SatelliteService<WorkflowConductorT>>;
  // databaseContext: DatabaseContext,
  networkReady: CustomHandler<WorkflowConductorT, unknown, unknown>;
  startup: CustomHandler<WorkflowConductorT, unknown, unknown>;
  shutdown: CustomHandler<WorkflowConductorT, unknown, unknown>;
  runOneURL: CustomHandler<WorkflowConductorT, URLRequest, CanonicalFieldRecords | ExtractionErrors>;
}

export const WorkflowConductor = defineSatelliteService<WorkflowConductorT>(
  'WorkflowConductor',
  async (commLink) => {
    // TODO ensure we have access to local filesystem and database
    // const dbConfig = getDBConfig();
    // if (dbConfig === undefined) {
    //   throw new Error('invalid database config; use env.{database,username,password}')
    // }
    // const databaseContext: DatabaseContext = { dbConfig };
    return {
      commLink,
      log: commLink.log,
      // databaseContext,
      async networkReady() { },
      async startup() { },
      async shutdown() { },

      async runOneURL(arg: URLRequest): Promise<CanonicalFieldRecords | ExtractionErrors> {
        const { url } = arg;

        this.log.info(`Fetching fields for ${url}`);

        // First attempt: if we have the data on disk, just return it
        let fieldRecs = getCanonicalFieldRecsForURL(url);
        let finalUrl: string | undefined;

        if (fieldRecs === undefined) {
          this.log.info(`No extracted fields found.. spidering ${url}`);

          const urlFetchData: UrlFetchData | undefined =
            await this.commLink.call('scrapeUrl', { url }, { to: SpiderService.name });

          if (urlFetchData === undefined) {
            return ExtractionErrors(`spider did not successfully scrape url ${url}`, { url });
          }

          finalUrl = urlFetchData.responseUrl;
          const entryPath = getCorpusEntryDirForUrl(url);
          this.log.info(`Extracting Fields in ${entryPath}`);

          await this.commLink.call('extractFields', { url }, { to: FieldExtractor.name });

          // try again:
          fieldRecs = getCanonicalFieldRecsForURL(url);
        }

        if (fieldRecs === undefined) {
          const msg = 'No extracted fields available';
          this.log.info(msg);
          return ExtractionErrors(msg, { url });
        }
        fieldRecs.finalUrl = finalUrl;

        return fieldRecs;
      }
    };
  });

interface FieldExtractor extends ExtractionSharedEnv {
  log: Logger;
  browserPool: BrowserPool;
  networkReady: CustomHandler<FieldExtractor, unknown, unknown>;
  startup: CustomHandler<FieldExtractor, unknown, unknown>;
  shutdown: CustomHandler<FieldExtractor, unknown, unknown>;
  extractFields: CustomHandler<FieldExtractor, { url: string }, void>;
}

// TODO spider/field extractor in same service to share browserPool
export const FieldExtractor = defineSatelliteService<FieldExtractor>(
  'FieldExtractor',
  async (commLink) => {
    const browserPool = createBrowserPool('FieldExtractor');
    return {
      log: commLink.log,
      browserPool,
      async networkReady() { },
      async startup() { },
      async shutdown() {
        await this.browserPool.shutdown();
      },
      async extractFields(arg): Promise<void> {
        const entryPath = getCorpusEntryDirForUrl(arg.url);
        const urlFetchData = readUrlFetchData(entryPath);
        const { log, browserPool } = this;
        const sharedEnv = {
          log,
          browserPool,
          urlFetchData
        }
        const exEnv = await initExtractionEnv(entryPath, sharedEnv);
        await extractFieldsForEntry(exEnv);
      },
    };
  });
