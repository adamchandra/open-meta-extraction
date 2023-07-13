import { getServiceLogger, isUrl } from '@watr/commonlib';
import { Schema, model } from 'mongoose';
import { createCurrentTimeOpt } from './mongodb';
import _ from 'lodash';

const log = getServiceLogger('MongoSchema');

export interface NoteStatus {
  _id: string;
  number: number;
  validUrl: boolean;
  url?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const NoteStatusSchema = new Schema<NoteStatus>({
  _id: { type: String },
  number: { type: Number, required: true, unique: true },
  validUrl: { type: Boolean, required: true },
  url: { type: String, required: false },
}, {
  collection: 'note_status',
  timestamps: createCurrentTimeOpt()
  // _id: false
});

NoteStatusSchema.on('index', error => {
  log.error('NoteStatus: indexing', error.message);
});

export const NoteStatus = model<NoteStatus>('NoteStatus', NoteStatusSchema);

type WorkflowStatusKeys = {
  available: null,
  'spider:locked': null,
  'spider:success': null,
  'spider:fail': null,
  'extractor:locked': null,
  'extractor:success': null,
  'extractor:fail': null,
};

const workflowStatusKeys: WorkflowStatusKeys = {
  available: null,
  'spider:locked': null,
  'spider:success': null,
  'spider:fail': null,
  'extractor:locked': null,
  'extractor:success': null,
  'extractor:fail': null,
};

export type WorkflowStatus = keyof WorkflowStatusKeys;
export const WorkflowStatuses: WorkflowStatus[] = _.keys(workflowStatusKeys) as any;

export function isWorkflowStatus(s: unknown): s is WorkflowStatus {
  return typeof s === 'string' && _.includes(WorkflowStatuses, s);
}

export interface HostStatus {
  _id: string;
  hasAbstract: boolean;
  hasPdfLink: boolean;
  validResponseUrl: boolean

  requestUrl: string;
  response: string;
  responseHost: string;
  httpStatus: number;
  workflowStatus: WorkflowStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type HostStatusUpdateFields = Partial<
  Pick<
    HostStatus,
    'hasAbstract' | 'response' | 'requestUrl' | 'httpStatus' | 'hasPdfLink'
  >>;

function NonNullable(v: unknown): boolean {
  return v !== null;
}


export const HostStatusSchema = new Schema<HostStatus>({
  _id: { type: String },
  hasAbstract: { type: Boolean, required: true },
  hasPdfLink: { type: Boolean, required: true },
  requestUrl: { type: String, required: true, index: true, validate: isUrl },
  validResponseUrl: { type: Boolean, required: false, validate: NonNullable },
  response: { type: String, required: false, },
  responseHost: { type: String, required: false, index: true },
  workflowStatus: { type: String, required: true, index: true, validate: isWorkflowStatus },
  httpStatus: { type: Number, required: false },
}, {
  collection: 'host_status',
  timestamps: createCurrentTimeOpt()
});

HostStatusSchema.on('index', error => {
  log.error('HostStatus: indexing', error.message);
});

export const HostStatus = model<HostStatus>('HostStatus', HostStatusSchema);


export interface FetchCursor {
  _id: string;
  noteId: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;

}
export const FetchCursorSchema = new Schema<FetchCursor>({
  _id: { type: String },
  noteId: { type: String, required: true },
  role: { type: String, required: true, unique: true },
}, {
  collection: 'fetch_cursor',
  timestamps: createCurrentTimeOpt(),
  _id: false
});

export const FetchCursor = model<FetchCursor>('FetchCursor', FetchCursorSchema);


type FieldState =
  'found:accepted'
  | 'found:rejected'
  | 'attempted' // set before extractor begins, and changed when extractor completes
  | 'notfound'
;

export interface FieldStatus {
  _id: string; // == NoteID
  fieldType: string;
  contentHash: string;
  state: FieldState;
  createdAt: Date;
  updatedAt: Date;
}

// export type FieldStatusUpdateFields = Partial<
//   Pick<
//     FieldStatus,
//     'hasAbstract' |  'response' | 'requestUrl' | 'httpStatus' | 'hasPdfLink'
//   >>;


export const FieldStatusSchema = new Schema<FieldStatus>({
  _id: { type: String },
  fieldType: { type: String, required: true, index: true },
  state: { type: String, required: true, index: true },
  contentHash: { type: String, required: false },
}, {
  collection: 'field_status',
  timestamps: createCurrentTimeOpt()
});

FieldStatusSchema.on('index', error => {
  log.error('FieldStatus: indexing', error.message);
});

export const FieldStatus = model<FieldStatus>('FieldStatus', FieldStatusSchema);

export async function createCollections() {
  await NoteStatus.createCollection();
  await HostStatus.createCollection();
  await FetchCursor.createCollection();
  await FieldStatus.createCollection();
}
