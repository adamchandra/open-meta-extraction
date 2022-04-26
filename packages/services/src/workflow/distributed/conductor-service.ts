import _ from 'lodash';
import { Logger } from 'winston';

import {
  CommLink,
  CustomHandler,
  defineSatelliteService,
  SatelliteService
} from '@watr/commlinks';

import { UrlFetchData } from '@watr/spider';

import {
  CanonicalFieldRecords,
  ExtractionErrors,
} from '@watr/field-extractors';

import { URLRequest } from '~/workflow/common/datatypes';

import { SpiderService } from './spider-service';
import { getCanonicalFieldRecsForURL } from '../common/utils';

export interface WorkflowConductorT {
  log: Logger;
  commLink: CommLink<SatelliteService<WorkflowConductorT>>;
  networkReady: CustomHandler<WorkflowConductorT, unknown, unknown>;
  startup: CustomHandler<WorkflowConductorT, unknown, unknown>;
  shutdown: CustomHandler<WorkflowConductorT, unknown, unknown>;
  runOneURL: CustomHandler<WorkflowConductorT, URLRequest, CanonicalFieldRecords | ExtractionErrors>;
}

export const WorkflowConductor = defineSatelliteService<WorkflowConductorT>(
  'WorkflowConductor',
  async (commLink) => {
    return {
      commLink,
      log: commLink.log,
      async networkReady() { },
      async startup() { },
      async shutdown() { },

      async runOneURL(arg: URLRequest): Promise<CanonicalFieldRecords | ExtractionErrors> {
        const { url } = arg;

        this.log.info(`Fetching fields for ${url}`);
        const urlFetchData: UrlFetchData | undefined =
          await this.commLink.call('scrapeAndExtract', { url }, { to: SpiderService.name });

        if (urlFetchData === undefined) {
          return ExtractionErrors(`spider did not successfully scrape url ${url}`, { url });
        }

        const finalUrl = urlFetchData.responseUrl;
        const fieldRecs = getCanonicalFieldRecsForURL(url);

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
