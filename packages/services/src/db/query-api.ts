import _ from 'lodash';
import * as E from 'fp-ts/Either';
import { Document, Mongoose, Types } from 'mongoose';
import { getServiceLogger, initConfig, shaEncodeAsHex, validateUrl } from '@watr/commonlib';
import { Logger } from 'winston';
import { FetchCursor, FieldStatus, HostStatus, HostStatusUpdateFields, NoteStatus, WorkflowStatus, createCollections } from './schemas';
import { connectToMongoDB } from './mongodb';
import { UpdatableField } from '~/components/openreview-gateway';
// import { TransactionOptions } from 'mongodb';

export type CursorID = Types.ObjectId;
export type HostStatusDocument = Document<unknown, any, HostStatus> & HostStatus;
export type NoteStatusDocument = Document<unknown, any, NoteStatus> & NoteStatus;
export type FetchCursorDocument = Document<unknown, any, FetchCursor> & FetchCursor;

type upsertNoteStatusArgs = {
  noteId: string,
  urlstr?: string,
  number?: number,
};

export async function createMongoQueries(): Promise<MongoQueries> {
  const s = new MongoQueries();
  await s.connect();
  return s;
}

export class MongoQueries {
  log: Logger;
  config: ReturnType<typeof initConfig>;
  mongoose?: Mongoose;

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
      throw new Error('No MongoDB Connection');
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
    noteId, urlstr, number
  }: upsertNoteStatusArgs): Promise<NoteStatus> {
    const maybeUrl = validateUrl(urlstr);
    const validUrl = E.isRight(maybeUrl);


    const urlOrErrStr = E.fold<string, URL, string>(
      () => `Invalid URL: ${urlstr}`,
      success => success.toString()
    )(maybeUrl);


    return NoteStatus.findOneAndUpdate(
      { _id: noteId },
      { number, validUrl, url: urlOrErrStr },
      { new: true, upsert: true }
    );
  }

  async findNoteStatusById(noteId: string): Promise<NoteStatus | undefined> {
    const ret = await NoteStatus.findOne({ _id: noteId });
    return ret === null ? undefined : ret;
  }

  async getNextNoteWithValidURL(noteNumber: number): Promise<NoteStatus | undefined> {
    const s = await NoteStatus.findOne(
      { number: { $gt: noteNumber }, validUrl: true },
    );
    return s || undefined;
  }

  async updateHostStatus(
    noteId: string,
    _fields?: HostStatusUpdateFields,
  ): Promise<HostStatusDocument|undefined> {
    const fields = _fields || {};
    const setQ: Record<string, any> = {};
    const unsetQ: Record<string, any> = {};

    // _.merge(setQ, fields, { workflowStatus });
    _.merge(setQ, fields);

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
      { new: true, runValidators: true }
    );
    return updated || undefined;
  }

  async upsertHostStatus(
    noteId: string,
    workflowStatus: WorkflowStatus,
    fields: HostStatusUpdateFields,
  ): Promise<HostStatusDocument> {
    const setQ: Record<string, any> = {};
    const unsetQ: Record<string, any> = {};

    _.merge(setQ, fields, { workflowStatus });
    _.merge(setQ, fields);

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
    return updated || undefined;
  }

  async findHostStatusById(noteId: string): Promise<HostStatusDocument | undefined> {
    const ret = await HostStatus.findOne({ _id: noteId });
    return ret === null ? undefined : ret;
  }

  async lockCursor(cursorId: CursorID): Promise<FetchCursor | undefined> {
    const c = await FetchCursor.findByIdAndUpdate(cursorId, { lockStatus: 'locked' }, { new: true });
    if (c) return c;
  }

  async unlockCursor(cursorId: CursorID): Promise<FetchCursor | undefined> {
    const c = await FetchCursor.findByIdAndUpdate(cursorId, { lockStatus: 'released' }, { new: true });
    if (c) return c;
  }


  async advanceCursor(cursorId: CursorID): Promise<FetchCursor | undefined> {
    const current = await FetchCursor.findById(cursorId);
    if (!current) return;
    const { noteNumber } = current;
    const nextNote = await this.getNextNoteWithValidURL(noteNumber);
    if (!nextNote) {
      return;
    };

    const nextCursor = await FetchCursor.findByIdAndUpdate(cursorId,
      {
        noteId: nextNote._id,
        noteNumber: nextNote.number,
        lockStatus: 'available'
      }, { new: true });

    if (!nextCursor) {
      return;
    };

    const c = await FetchCursor.findById(cursorId);
    if (c) return c;
  }

  async getCursor(role: CursorRole): Promise<FetchCursor | undefined> {
    const cursor = await FetchCursor.findOne({ role });
    if (cursor === null || cursor === undefined) {
      return;
    }
    return cursor;
  }

  async deleteCursor(role: CursorRole): Promise<boolean> {
    const cursor = await FetchCursor.findOneAndRemove({ role });
    return cursor !== null;
  }

  async updateCursor(role: CursorRole, noteId: string): Promise<FetchCursor> {
    return FetchCursor.findOneAndUpdate(
      { role },
      { role, noteId },
      { new: true, upsert: true }
    );
  }

  async createCursor(role: CursorRole, noteId: string): Promise<FetchCursor | undefined> {
    const noteStatus = await this.findNoteStatusById(noteId);
    if (!noteStatus) return;
    const c = await FetchCursor.create(
      { role, noteId, noteNumber: noteStatus.number },
    );

    return c;
  }

  async upsertFieldStatus(
    noteId: string,
    fieldType: string,
    fieldValue: string,
  ): Promise<FieldStatus> {
    const contentHash = shaEncodeAsHex(fieldValue);
    return FieldStatus.findOneAndUpdate(
      { noteId, fieldType },
      { fieldType, contentHash },
      { new: true, upsert: true }
    );
  }

  async getFieldStatus(
    noteId: string,
    fieldType: string,
  ): Promise<FieldStatus | undefined> {
    const s = await FieldStatus.findOne({ noteId, fieldType });
    return s ? s : undefined;
  }


}

// TODO move these to shadowDB
export type ExtractedFieldName = UpdatableField; // 'abstract' | 'pdf-link';
export type ExtractedFieldStatus = 'preexisting' | 'not-found' | 'found' | 'failed' | 'locked';

export type CursorRole = 'fetch-openreview-notes' | 'extract-fields';
export const CursorRoles: CursorRole[] = [ 'fetch-openreview-notes', 'extract-fields'];

export function isCursorRole(s: unknown): s is CursorRole {
  return typeof s === 'string' && _.includes(CursorRoles, s)
}
// Advance the cursor using transactions, which only works if MongoDB is running with replication sets.
// async advanceCursorReplSet(cursorId: CursorID): Promise<FetchCursor | undefined> {
//   const sess = await this.conn().startSession();

//   try {

//     await sess.withTransaction(async (session) => {
//       const released = await FetchCursor.findById(cursorId, null, { session });
//       if (!released) return;
//       const { noteNumber } = released;
//       const noteStatus = await NoteStatus.findOne(
  //         { number: { $gt: noteNumber }, validUrl: true },
  //         null,
  //         { session }
  //       );
  //       if (!noteStatus) {
  //         await session.abortTransaction();
  //         return;
  //       };

  //       const advanced = await FetchCursor.findByIdAndUpdate(
  //         cursorId,
  //         { noteId: noteStatus._id, lockStatus: 'available' },
  //         { session }
  //       );

  //       if (!advanced) {
  //         await session.abortTransaction();
  //         return;
  //       };
  //     });

  //   } finally {
  //     await sess.endSession();
  //   }
  //   const c = await FetchCursor.findById(cursorId);
  //   if (c) return c;
  // }

  // TODO delete code block
  // async resetUrlsWithMissingFields(): Promise<void> {
  //   const resetUrlsWithoutAbstractsUpdate = await HostStatus.updateMany({
  //     hasAbstract: false,
  //     httpStatus: { $not: { $in: [404, 500] } }
  //   }, {
  //     workflowStatus: 'available'
  //   });

  //   const resetUrlsWithoutPdfLinkUpdate = await HostStatus.updateMany({
  //     hasPdfLink: false,
  //     httpStatus: { $not: { $in: [404, 500] } }
  //   }, {
  //     workflowStatus: 'available'
  //   });
  //   const resetLockedUrlsUpdate = await HostStatus.updateMany({
  //     workflowStatus: { $in: ['spider-locked', 'extractor-locked'] }
  //   }, {
  //     workflowStatus: 'available'
  //   });

  //   prettyPrint({ resetUrlsWithoutAbstractsUpdate, resetUrlsWithoutPdfLinkUpdate, resetLockedUrlsUpdate });
  // }

  // TODO dtb
  // async findNextViewTmp(): Promise<void> {
  //   await this.conn().createCollection('nextAvailableURL', {
  //     viewOn: 'host_status',
  //     pipeline: [
  //       {
  //         $lookup: {
  //           from: "field_status",
  //           localField: "_id",
  //           foreignField: "noteId",
  //           as: "inventoryDocs"
  //         }
  //       },
  //       {
  //         $project:
  //         {
  //           _id: 0,
  //           prodId: 1,
  //           orderId: 1,
  //           numPurchased: 1,
  //           price: "$inventoryDocs.price"
  //         }
  //       },
  //       { $unwind: "$price" }
  //     ]
  //     // collation: {  }
  //     // {
  //   })

  // }
