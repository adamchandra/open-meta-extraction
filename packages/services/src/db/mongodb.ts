import mongoose from 'mongoose';

import { Schema, model, Mongoose } from 'mongoose';

const MongoTestDBName = 'testdb'
const MongoProductionDBName = 'corefdb'

function mongoConnectionString(): string {
    return `mongodb://localhost:27017/${MongoTestDBName}`;
}

export async function connectToMongoDB(): Promise<Mongoose> {
    return mongoose.connect(mongoConnectionString());
}

export interface CPAuthor {
    position: number;
    author_name: string;
}
export const CPAuthorSchema = new Schema<CPAuthor>({
    position: { type: Number, required: true },
    author_name: { type: String, required: true }
}, { _id: false });

export interface CorefPaper {
    paper_id: string,
    title: string,
    abstract?: string,
    journal_name?: string,
    venue?: string,
    year?: number,
    references: string[],
    authors: CPAuthor[];
}

export const CorefPaperSchema = new Schema<CorefPaper>({
    paper_id: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    abstract: { type: String, required: false },
    journal_name: { type: String, required: false },
    venue: { type: String, required: false },
    year: { type: Number, required: false },
    references: [{ type: String, required: true }],
    authors: [CPAuthorSchema]
}, {
    collection: 'paper'
});

CorefPaperSchema.on('index', error => {
    console.log('CorefPaperSchema: indexing', error.message);
});

export const CorefPaperModel = model<CorefPaper>("Paper", CorefPaperSchema);


export interface CSAuthorInfo {
    position: number;
    given_block: string,
    block: string,
    fullname: string;
    openId: string;
    first: string;
    middle: string;
    last: string;
    suffix: string;
    affiliations: string[];
    email: string;
}

export const CSAuthorInfoSchema = new Schema<CSAuthorInfo>({
    position: { type: Number, required: true },
    given_block: { type: String, required: true },
    block: { type: String, required: true, index: true },
    fullname: { type: String, required: true },
    openId: { type: String, required: true },
    first: { type: String, required: false },
    middle: { type: String, required: false },
    last: { type: String, required: false },
    suffix: { type: String, required: false },
    affiliations: [{ type: String, required: false }],
    email: { type: String, required: false },
}, { _id: false, collection: 'signatures' });

export interface CorefSignature {
    paper_id: string;
    author_id: string;
    signature_id: string;
    author_info: CSAuthorInfo
}

export const CorefSignatureSchema = new Schema<CorefSignature>({
    paper_id: { type: String, required: true, index: true },
    author_id: { type: String, required: true },
    signature_id: { type: String, required: true, unique: true },
    author_info: CSAuthorInfoSchema
});

CorefSignatureSchema.on('index', error => {
    console.log('CorefSignatureSchema: indexing', error.message);
});

export const CorefSignatureModel = model<CorefSignature>("Signature", CorefSignatureSchema);

export interface Cluster {
    prediction_group: string;
    cluster_id: string;
    signature_id: string;
    canopy: string;
}

export const ClusterSchema = new Schema<Cluster>({
    prediction_group: { type: String, required: true, index: true },
    cluster_id: { type: String, required: true, index: true },
    signature_id: { type: String, required: true, index: true },
    canopy: { type: String, required: true, index: true }
}, {
    collection: 'clusters'
});

ClusterSchema.on('index', error => {
    console.log('ClusterSchema: indexing', error.message);
});

export const ClusterModel = model<Cluster>("Cluster", ClusterSchema);

export async function createCollections() {
    await CorefPaperModel.createCollection();
    await CorefSignatureModel.createCollection();
    await ClusterModel.createCollection();

}
