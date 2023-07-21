import _ from 'lodash';
import * as E from 'fp-ts/Either';
import { Document, Mongoose, Types } from 'mongoose';
import { asyncEachSeries, asyncMapSeries, getServiceLogger, initConfig, prettyPrint, shaEncodeAsHex, validateUrl } from '@watr/commonlib';
import { Logger } from 'winston';
import { FetchCursor, FieldStatus, UrlStatus, UrlStatusUpdateFields, NoteStatus, WorkflowStatus, createCollections } from './schemas';
import { connectToMongoDB } from './mongodb';
import { UpdatableField } from '~/components/openreview-gateway';
// import { TransactionOptions } from 'mongodb';

export type CursorID = Types.ObjectId;
export type UrlStatusDocument = Document<unknown, any, UrlStatus> & UrlStatus;
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
      null,
      { sort: { number: 1 } }
    );
    return s || undefined;
  }
  async getPrevNoteWithValidURL(noteNumber: number): Promise<NoteStatus | undefined> {
    const s = await NoteStatus.findOne(
      { number: { $lt: noteNumber }, validUrl: true },
      null,
      { sort: { number: -1 } }
    );
    return s || undefined;
  }

  async updateUrlStatus(
    noteId: string,
    _fields?: UrlStatusUpdateFields,
  ): Promise<UrlStatusDocument | undefined> {
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

    const updated = await UrlStatus.findOneAndUpdate(
      { _id: noteId },
      updateQ,
      { new: true, runValidators: true }
    );
    return updated || undefined;
  }

  async upsertUrlStatus(
    noteId: string,
    workflowStatus: WorkflowStatus,
    fields: UrlStatusUpdateFields,
  ): Promise<UrlStatusDocument> {
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

    const updated = await UrlStatus.findOneAndUpdate(
      { _id: noteId },
      updateQ,
      { new: true, upsert: true, runValidators: true }
    );
    return updated || undefined;
  }

  async findUrlStatusById(noteId: string): Promise<UrlStatusDocument | undefined> {
    const ret = await UrlStatus.findOne({ _id: noteId });
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

  async moveCursor(cursorId: CursorID, distance: number): Promise<FetchCursor | string> {
    if (distance === 0) {
      return 'Cannot move cursor a distance of 0';
    }
    const direction = distance > 0 ? 'forward' : 'back';
    const absDist = Math.abs(distance);
    this.log.info(`Moving Cursor ${direction} by ${absDist}`);

    const current = await FetchCursor.findById(cursorId);
    if (!current) return `No cursor w/id ${cursorId}`;

    const { noteNumber } = current;
    let currNote = noteNumber;
    let notes = await asyncMapSeries(_.range(absDist), async () => {
      if (distance > 0) {
        const n = await this.getNextNoteWithValidURL(currNote);
        if (!n) return undefined;
        currNote = n.number;
        return n;
      }
      const n = await this.getPrevNoteWithValidURL(currNote);
      if (!n) return undefined;
      currNote = n.number;
      return n;
    });

    notes = _.flatMap(notes, (n) => _.isUndefined(n) ? [] : [n]);

    if (notes.length < absDist) {
      return `Too few notes (${notes.length} found) to move ${direction} from note:${current.noteId}, #${current.noteNumber}`;
    }

    const lastNote = notes.at(-1);
    if (!lastNote) {
      throw Error('Error: notes are empty');
    }

    const nextCursor = await FetchCursor.findByIdAndUpdate(cursorId,
      {
        noteId: lastNote._id,
        noteNumber: lastNote.number,
        lockStatus: 'available'
      }, { new: true });

    if (!nextCursor) {
      return 'No next cursor';
    };

    return nextCursor;
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
export const CursorRoles: CursorRole[] = ['fetch-openreview-notes', 'extract-fields'];

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
  //   const resetUrlsWithoutAbstractsUpdate = await UrlStatus.updateMany({
  //     hasAbstract: false,
  //     httpStatus: { $not: { $in: [404, 500] } }
  //   }, {
  //     workflowStatus: 'available'
  //   });

  //   const resetUrlsWithoutPdfLinkUpdate = await UrlStatus.updateMany({
  //     hasPdfLink: false,
  //     httpStatus: { $not: { $in: [404, 500] } }
  //   }, {
  //     workflowStatus: 'available'
  //   });
  //   const resetLockedUrlsUpdate = await UrlStatus.updateMany({
  //     workflowStatus: { $in: ['spider-locked', 'extractor-locked'] }
  //   }, {
  //     workflowStatus: 'available'
  //   });

  //   prettyPrint({ resetUrlsWithoutAbstractsUpdate, resetUrlsWithoutPdfLinkUpdate, resetLockedUrlsUpdate });
  // }

  // TODO dtb
  // async findNextViewTmp(): Promise<void> {
  //   await this.conn().createCollection('nextAvailableURL', {
  //     viewOn: 'url_status',
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
