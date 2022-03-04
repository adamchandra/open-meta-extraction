import { AlphaRecord } from "@watr/commonlib";

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

export function toUrl(instr: unknown): URL | string {
  if (typeof instr !== 'string') {
    return 'toURL error: input must be string';
  }
  const str = instr.trim();
  if (instr.includes(' ')) {
    return 'toURL error: input string has spaces';
  }

  try {
    return new URL(str); // eslint-disable-line no-new
  } catch (error) {
    return `toURL error: new URL() threw ${error}`;
  }
}

export function isUrl(instr: unknown): boolean {
  return typeof toUrl(instr) !== 'string';
}
