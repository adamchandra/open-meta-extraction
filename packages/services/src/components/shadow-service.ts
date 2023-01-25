import _ from 'lodash';

import {
  asyncEachSeries,
  getServiceLogger,
  delay,
  asyncForever
} from '@watr/commonlib';

import { Note } from './openreview-exchange';

import { WorkflowStatus } from '~/db/schemas';

import {
  findNoteStatusById,
  getNextSpiderableUrl,
  HostStatusDocument,
  resetUrlsWithMissingFields,
  upsertHostStatus,
  upsertNoteStatus,
  releaseSpiderableUrl
} from '~/db/query-api';

import { OpenReviewGateway, UpdatableField } from './openreview-gateway';
import { Logger } from 'winston';


export class ShadowService {
  log: Logger;
  gate: OpenReviewGateway;


  constructor() {
    this.log = getServiceLogger('ShadowService');
    this.gate = new OpenReviewGateway();
  }

  // async updateNoteFields(
  //   noteId: string,
  //   fields: Record<UpdatableField, string|undefined>
  // ): Promise<void> {
  //   asyncEachSeries(_.keys(fields), (key) => {
  //     const value = fields[key];
  //     if (value !== undefined) {
  //       await this.gate.doUpdateNoteField(noteId, key, value);

  //     }
  //   });
  //   await this.gate.doUpdateNoteField(noteId, fieldName, fieldValue);
  //   // TODO: change schema to something like:
  //   //    `${fieldname}_status`: found | not_found
  //   // await upsertHostStatus(noteId, 'extractor:success', {
  //   //   `has${fieldName}`,
  //   //   // hasAbstract,
  //   //   // hasPdfLink,
  //   //   // httpStatus,
  //   //   // response: responseUrl
  //   // });
  // }


  async doUpdateNoteField(
    noteId: string,
    fieldName: UpdatableField,
    fieldValue: string
  ): Promise<void> {
    await this.gate.doUpdateNoteField(noteId, fieldName, fieldValue);
    // TODO: change schema to something like:
    //    `${fieldname}_status`: found | not_found
    // await upsertHostStatus(noteId, 'extractor:success', {
    //   `has${fieldName}`,
    //   // hasAbstract,
    //   // hasPdfLink,
    //   // httpStatus,
    //   // response: responseUrl
    // });


  }

  async getNextAvailableUrl(): Promise<HostStatusDocument | undefined> {
    const nextSpiderable = await getNextSpiderableUrl();

    // TODO change this retry logic to only reset on code updates
    if (nextSpiderable === undefined) {
      this.log.info('runRelayExtract(): no more spiderable urls in mongo');
      await resetUrlsWithMissingFields();
      return;
    }
    return;
  }

  async releaseSpiderableUrl(hostStatus: HostStatusDocument, newStatus: WorkflowStatus): Promise<HostStatusDocument> {
    return releaseSpiderableUrl(hostStatus, newStatus);
  }
}
