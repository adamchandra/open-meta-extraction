import { initConfig, isTestingEnv, putStrLn } from '@watr/commonlib';
import mongoose from 'mongoose';

import { Schema, model, Mongoose } from 'mongoose';

function mongoConnectionString(): string {
    const config = initConfig();
    const ConnectionURL = config.get('mongodb:connectionUrl');
    const MongoDBName = config.get('mongodb:dbName');
    return `${ConnectionURL}/${MongoDBName}`;
}

export async function connectToMongoDB(): Promise<Mongoose> {
    const connstr = mongoConnectionString()
    putStrLn(`connecting to ${connstr}`)
    return mongoose.connect(connstr);
}

interface CurrentTimeOpt {
    currentTime(): Date;
}

let timeStampOpts: CurrentTimeOpt = {
    currentTime: () => new Date()
};

export function useMockTimestamps() {
    if (!isTestingEnv()) {
        // Only valid during unit tests
        return;
    }
    putStrLn('setting useMockTimestamps')
    const currentFakeDate = new Date()
    currentFakeDate.setDate(currentFakeDate.getDate() - 14)
    const opts: CurrentTimeOpt = {
        currentTime: () => {
            const currDate = new Date(currentFakeDate)
            const rando = Math.floor(Math.random() * 10) + 1
            const jitter = rando % 4;
            currentFakeDate.setHours(currentFakeDate.getHours() + jitter)
            return currDate;
        }
    };
    timeStampOpts = opts;
}

if (isTestingEnv()) {
    useMockTimestamps();
}

export interface NoteStatus {
    noteId: string;
    hasUrl: boolean;
    hasAbstract: boolean;
    url: string;
    createdAt: Date;
    updatedAt: Date;
}

export const NoteStatusSchema = new Schema<NoteStatus>({
    noteId: { type: String, required: true, index: true },
    hasUrl: { type: Boolean, required: true },
    hasAbstract: { type: Boolean, required: true },
    url: { type: String, required: true, index: true },
}, {
    collection: 'note_status',
    timestamps: timeStampOpts
});

NoteStatusSchema.on('index', error => {
    console.log('NoteStatus: indexing', error.message);
});

export const NoteStatus = model<NoteStatus>("NoteStatus", NoteStatusSchema);


export interface HostStatus {
    noteId: string;
    hasUrl: boolean;
    hasAbstract: boolean;

    requestUrl: string;
    responseUrl: string;
    responseHost: string;
    httpStatus: number;
    // extractedFields: string[];
    createdAt: Date;
    updatedAt: Date;
}

export const HostStatusSchema = new Schema<HostStatus>({
    noteId: { type: String, required: true, index: true },
    hasUrl: { type: Boolean, required: true },
    hasAbstract: { type: Boolean, required: true },

    requestUrl: { type: String, required: true, index: true },
    responseUrl: { type: String, required: true },
    responseHost: { type: String, required: true, index: true },
    httpStatus: { type: Number, required: true },
    // extractedFields: [{ type: String, required: true, index: true }],
}, {
    collection: 'host_status',
    timestamps: timeStampOpts
});

HostStatusSchema.on('index', error => {
    console.log('HostStatus: indexing', error.message);
});

export const HostStatus = model<HostStatus>("HostStatus", HostStatusSchema);

export async function createCollections() {
    await NoteStatus.createCollection();
    await HostStatus.createCollection();
}
