import { getServiceLogger } from '@watr/commonlib';
import { Schema, model } from 'mongoose';
import { createCurrentTimeOpt } from './mongodb';
import _ from 'lodash';
import { isUrl } from '~/workflow/common/datatypes';

const log = getServiceLogger("MongoSchema")

export interface NoteStatus {
    _id: string;
    validUrl: boolean;
    url?: string;
    createdAt: Date;
    updatedAt: Date;
}

export const NoteStatusSchema = new Schema<NoteStatus>({
    _id: { type: String },
    validUrl: { type: Boolean, required: true },
    url: { type: String, required: false },
}, {
    collection: 'note_status',
    timestamps: createCurrentTimeOpt(),
    _id: false
});

NoteStatusSchema.on('index', error => {
    log.error('NoteStatus: indexing', error.message);
});

export const NoteStatus = model<NoteStatus>("NoteStatus", NoteStatusSchema);

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
export const WorkflowStatuses = _.keys(workflowStatusKeys);

export function isWorkflowStatus(s: unknown): s is WorkflowStatus {
    return typeof s === 'string' && _.includes(WorkflowStatuses, s);
}

export interface HostStatus {
    _id: string;
    hasAbstract: boolean;
    validResponseUrl: boolean

    requestUrl: string;
    response: string;
    responseHost: string;
    httpStatus: number;
    workflowStatus: WorkflowStatus;
    createdAt: Date;
    updatedAt: Date;
}

export type HostStatusUpdateFields = Partial<Pick<HostStatus, 'hasAbstract' | 'response' | 'requestUrl' | 'httpStatus'>>;

function NonNullable(v: unknown): boolean {
    return v !== null
}


export const HostStatusSchema = new Schema<HostStatus>({
    _id: { type: String },
    hasAbstract: { type: Boolean, required: true },
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

export const HostStatus = model<HostStatus>("HostStatus", HostStatusSchema);

export async function createCollections() {
    await NoteStatus.createCollection();
    await HostStatus.createCollection();
}
