import { AlphaRecord } from "@watr/commonlib";

export interface RecordRequest {
  kind: 'record-request';
  alphaRec: AlphaRecord;
}

export const RecordRequest = (alphaRec: AlphaRecord): RecordRequest => ({
  kind: 'record-request',
  alphaRec
});

export type WorkflowData =
  RecordRequest
  ;

export interface ErrorRecord {
  error: string;
}

export const ErrorRecord = (error: string): ErrorRecord => ({ error });
