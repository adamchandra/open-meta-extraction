import { promisify } from 'util';
import { RestPortal, createRestServer } from '~/http-servers/rest-portal/rest-worker';

import _ from 'lodash';
import { DatabaseContext } from '~/db/db-api';
import { getDBConfig } from '~/db/database';

import {
  defineSatelliteService, SatelliteService
} from '@watr/commlinks';

import { getCanonicalFieldRecs, getCanonicalFieldRecsForURL } from '~/workflow/inline/inline-workflow';
import { UrlFetchData } from '@watr/spider';
import { getCorpusEntryDirForUrl } from '@watr/commonlib';
import { CanonicalFieldRecords, extractFieldsForEntry } from '@watr/field-extractors';
import { ErrorRecord, RecordRequest, URLRequest, WorkflowData } from '../common/datatypes';

export const RestPortalService = defineSatelliteService<RestPortal>(
  'RestPortal',
  () => createRestServer(), {
  async networkReady() {
    // Do configuratino post-connection w/hub, but before workflow initiates
  },
  async startup() {
    this.cargo.setCommLink(this.commLink);
    return this.cargo.run();
  },
  async shutdown() {
    this.log.debug(`${this.serviceName} [shutdown]> `)

    const { server } = this.cargo;
    const doClose = promisify(server.close).bind(server);
    return doClose().then(() => {
      this.log.debug(`${this.serviceName} [server:shutdown]> `)
    });
  },
  async runOneAlphaRec(arg: WorkflowData): Promise<WorkflowData> {
    return arg;
  },

  async runOneAlphaRecNoDB(arg: RecordRequest): Promise<CanonicalFieldRecords | ErrorRecord> {
    const res: CanonicalFieldRecords | ErrorRecord = await this.commLink.call(
      'runOneAlphaRecNoDB',
      arg,
      { to: WorkflowConductor.name }
    );
    return res;
  },

});

export interface WorkflowConductorT {
  databaseContext: DatabaseContext,
}

// TODO split out the file system parts (ArtifactService)?
export const WorkflowConductor = defineSatelliteService<WorkflowConductorT>(
  'WorkflowConductor',
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
  async networkReady() { },
  async startup() { },
  async shutdown() { },

  async runOneAlphaRec(arg: WorkflowData): Promise<WorkflowData> {
    // insertNewUrlChains(databaseContext)
    return arg;
  },

  async runOneURLNoDB(arg: URLRequest): Promise<CanonicalFieldRecords | ErrorRecord> {
    const { url } = arg;

    this.log.info(`Fetching fields for ${url}`);

    // First attempt: if we have the data on disk, just return it
    let fieldRecs = getCanonicalFieldRecsForURL(url);

    if (fieldRecs === undefined) {
      this.log.info(`No extracted fields found.. spidering ${url}`);

      const urlFetchData: UrlFetchData | undefined =
        await this.commLink.call('scrapeUrl', { url }, { to: 'Spider' });
      // await this.commLink.call<{ url: string }, UrlFetchData>('scrapeUrl', { url }, { to: 'Spider' });

      if (urlFetchData === undefined) {
        return ErrorRecord(`spider did not successfully scrape url ${url}`);
      }

      const entryPath = getCorpusEntryDirForUrl(url);
      this.log.info(`Extracting Fields in ${entryPath}`);

      // await this.commLink.call<{ url: string }, UrlFetchData>('extractFields', { url }, { to: 'FieldExtractor' });
      await this.commLink.call('extractFields', { url }, { to: 'FieldExtractor' });

      // try again:
      fieldRecs = getCanonicalFieldRecsForURL(url);
    }

    if (fieldRecs === undefined) {
      const msg = 'No extracted fields available';
      this.log.info(msg);
      return ErrorRecord(msg);
    }

    return fieldRecs;
  },

  async runOneAlphaRecNoDB(arg: RecordRequest): Promise<CanonicalFieldRecords | ErrorRecord> {
    const { alphaRec } = arg;
    const { url } = alphaRec;

    this.log.info(`Fetching fields for ${url}`);

    // First attempt: if we have the data on disk, just return it
    let fieldRecs = getCanonicalFieldRecs(alphaRec);

    if (fieldRecs === undefined) {
      this.log.info(`No extracted fields found.. spidering ${url}`);

      const urlFetchData: UrlFetchData | undefined =
        await this.commLink.call('scrapeUrl', { url }, { to: 'Spider' });
      // await this.commLink.call<{ url: string }, UrlFetchData>('scrapeUrl', { url }, { to: 'Spider' });

      if (urlFetchData === undefined) {
        return ErrorRecord(`spider did not successfully scrape url ${url}`);
      }

      const entryPath = getCorpusEntryDirForUrl(url);
      this.log.info(`Extracting Fields in ${entryPath}`);

      // await this.commLink.call<{ url: string }, UrlFetchData>('extractFields', { url }, { to: 'FieldExtractor' });
      await this.commLink.call('extractFields', { url }, { to: 'FieldExtractor' });

      // try again:
      fieldRecs = getCanonicalFieldRecs(alphaRec);
    }

    if (fieldRecs === undefined) {
      const msg = 'No extracted fields available';
      this.log.info(msg);
      return ErrorRecord(msg);
    }

    return fieldRecs;
  },
});

// TODO spider/field extractor in same service to share browserPool
export const FieldExtractor = defineSatelliteService<void>(
  'FieldExtractor',
  async () => undefined, {

  async networkReady() { },
  async startup() { },
  async shutdown() { },

  async extractFields(arg: { url: string }): Promise<void> {
    const entryPath = getCorpusEntryDirForUrl(arg.url);
    await extractFieldsForEntry(entryPath, this.log)
  },
});
