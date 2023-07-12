import _ from 'lodash';
import { FetchCursor, HostStatus, HostStatusUpdateFields, NoteStatus, WorkflowStatus, createCollections } from './schemas';
import * as E from 'fp-ts/Either';
import { Document, Mongoose } from 'mongoose';
import { getServiceLogger, initConfig, prettyPrint, validateUrl } from '@watr/commonlib';
import { Logger } from 'winston';
import { connectToMongoDB } from './mongodb';

export type HostStatusDocument = Document<unknown, any, HostStatus> & HostStatus;

type upsertNoteStatusArgs = {
  noteId: string,
  urlstr?: string
}

// type ConnectStatus =
//   'unconnected'
//   | 'connecting'
//   | 'connected'
//   | 'closing'
//   | 'closed'
//   ;

export class MongoQueries {
  log: Logger;
  config: ReturnType<typeof initConfig>;
  mongoose?: Mongoose;
  // connectStatus: ConnectStatus;

  constructor() {
    this.log = getServiceLogger('MongoQueries');
    this.config = initConfig();
  }

  async connect() {
    this.mongoose = await connectToMongoDB();
  }

  async close() {
    if (this.mongoose) {
      const conn = this.mongoose;
      this.mongoose = undefined;
      await conn.connection.close();
    }
  }

  conn() {
    if (!this.mongoose) {
      throw new Error('No MongoDB Connection')
    }
    return this.mongoose.connection;
  }

  async dropDatabase() {
    await this.conn().dropDatabase();
  }

  async createDatabase() {
    await createCollections();
  }

  async upsertNoteStatus({
    noteId, urlstr
  }: upsertNoteStatusArgs): Promise<NoteStatus> {
    const maybeUrl = validateUrl(urlstr);
    const validUrl = E.isRight(maybeUrl);


    const urlOrErrStr = E.fold<string, URL, string>(
      () => `Invalid URL: ${urlstr}`,
      success => success.toString()
    )(maybeUrl);


    return NoteStatus.findOneAndUpdate(
      { _id: noteId },
      { validUrl, url: urlOrErrStr },
      { new: true, upsert: true }
    );
  }

  async findNoteStatusById(noteId: string): Promise<NoteStatus | undefined> {
    const ret = await NoteStatus.findOne({ _id: noteId });
    return ret !== null ? ret : undefined;
  }

  async upsertHostStatus(
    noteId: string,
    workflowStatus: WorkflowStatus,
    fields: HostStatusUpdateFields
  ): Promise<HostStatusDocument> {

    const setQ: Record<string, any> = {};
    const unsetQ: Record<string, any> = {};

    _.merge(setQ, fields, { workflowStatus });

    if ('response' in fields) {
      const { response } = fields;
      const maybeUrl = validateUrl(response);
      const validResponseUrl = E.isRight(maybeUrl);
      _.merge(setQ, { validResponseUrl });

      if (validResponseUrl) {
        const responseHost = maybeUrl.right.hostname;
        _.merge(setQ, { responseHost });
      } else {
        _.merge(unsetQ, { responseHost: '' });
      }
    }

    const updateQ: Record<string, any> = {
      $set: setQ,
      $unset: unsetQ,
    };

    const updated = await HostStatus.findOneAndUpdate(
      { _id: noteId },
      updateQ,
      { new: true, upsert: true, runValidators: true }
    );
    return updated;
  }

  async findHostStatusById(noteId: string): Promise<HostStatusDocument | undefined> {
    const ret = await HostStatus.findOne({ _id: noteId });
    return ret !== null ? ret : undefined;
  }

  async getNextSpiderableUrl(): Promise<HostStatusDocument | undefined> {
    const next = await HostStatus.findOneAndUpdate(
      {
        $and: [
          { $or: [{ hasAbstract: false }, { hasPdfLink: false }] },
          { workflowStatus: 'available' }
        ]
      },
      { workflowStatus: 'spider:locked' },
      { new: true }
    );
    return next !== null ? next : undefined;
  }

  async releaseSpiderableUrl(hostStatus: HostStatusDocument, newStatus: WorkflowStatus): Promise<HostStatusDocument> {
    hostStatus.workflowStatus = newStatus;
    return hostStatus.save();
  }

  async resetUrlsWithMissingFields(): Promise<void> {
    const resetUrlsWithoutAbstractsUpdate = await HostStatus.updateMany({
      hasAbstract: false,
      httpStatus: { $not: { $in: [404, 500] } }
    }, {
      workflowStatus: 'available'
    });

    const resetUrlsWithoutPdfLinkUpdate = await HostStatus.updateMany({
      hasPdfLink: false,
      httpStatus: { $not: { $in: [404, 500] } }
    }, {
      workflowStatus: 'available'
    });
    const resetLockedUrlsUpdate = await HostStatus.updateMany({
      workflowStatus: { $in: ['spider-locked', 'extractor-locked'] }
    }, {
      workflowStatus: 'available'
    });

    prettyPrint({ resetUrlsWithoutAbstractsUpdate, resetUrlsWithoutPdfLinkUpdate, resetLockedUrlsUpdate });
  }

  async getNamedCursor(name: CursorName): Promise<FetchCursor | undefined> {
    const cursor = await FetchCursor.findOne({name});
    if (cursor === null || cursor === undefined) {
      return;
    }
    return cursor;
  }
  async deleteNamedCursor(name: CursorName): Promise<boolean> {
    const cursor = await FetchCursor.findOneAndRemove({name});
    return cursor !== null;
  }

  async updateFetchCursor(name: CursorName, noteId: string, fieldName: FieldName): Promise<FetchCursor> {
    return FetchCursor.findOneAndUpdate(
      { name },
      { name, fieldName, noteId },
      { new: true, upsert: true }
    );
  }

}

export type CursorName = 'front-cursor' | 'rear-cursor';
export type FieldName = 'abstract' | 'pdf-link' | '*';
