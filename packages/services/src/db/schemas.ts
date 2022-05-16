import { Schema, model } from 'mongoose';
import { createCurrentTimeOpt } from './mongodb';

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
    console.log('NoteStatus: indexing', error.message);
});

export const NoteStatus = model<NoteStatus>("NoteStatus", NoteStatusSchema);


export interface HostStatus {
    _id: string;
    hasAbstract: boolean;
    validResponseUrl: boolean

    requestUrl: string;
    response: string;
    responseHost: string;
    httpStatus: number;
    createdAt: Date;
    updatedAt: Date;
}

export type HostStatusUpdateFields = Partial<Omit<HostStatus, 'createdAt' | 'updatedAt' | '_id'>>;
export type HostStatusUpdate = { _id: string } & HostStatusUpdateFields;

export const HostStatusSchema = new Schema<HostStatus>({
    _id: { type: String },
    hasAbstract: { type: Boolean, required: true },
    validResponseUrl: { type: Boolean, required: false },

    requestUrl: { type: String, required: true, index: true, unique: true },
    response: { type: String, required: false },
    responseHost: { type: String, required: false, index: true },
    httpStatus: { type: Number, required: false },
}, {
    collection: 'host_status',
    timestamps: createCurrentTimeOpt()
});

HostStatusSchema.on('index', error => {
    console.log('HostStatus: indexing', error.message);
});

export const HostStatus = model<HostStatus>("HostStatus", HostStatusSchema);

export async function createCollections() {
    await NoteStatus.createCollection();
    await HostStatus.createCollection();
}
