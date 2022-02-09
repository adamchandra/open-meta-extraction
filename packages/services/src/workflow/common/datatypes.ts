import { AlphaRecord } from "@watr/commonlib";
import { boolean } from "fp-ts";

export interface RecordRequest {
  kind: 'record-request';
  alphaRec: AlphaRecord;
}

export const RecordRequest = (alphaRec: AlphaRecord): RecordRequest => ({
  kind: 'record-request',
  alphaRec
});

export interface URLRequest {
  kind: 'url-request';
  url: string;
}
export const URLRequest = (url: string): URLRequest => ({
  kind: 'url-request',
  url
});

export type WorkflowData =
  RecordRequest
  | URLRequest
  ;

export interface ErrorRecord {
  error: string;
}

export const ErrorRecord = (error: string): ErrorRecord => ({ error });

export function isUrl(instr: unknown): boolean {
  if (typeof instr !== 'string') {
    return false;
  }
  const str = instr.trim();
  if (typeof str === 'string') {
    if (instr.includes(' ')) {
      return false;
    }

    try {
      new URL(str); // eslint-disable-line no-new
      return true;
    } catch {
      return false;
    }
  }

}
