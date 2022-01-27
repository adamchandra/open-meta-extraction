import { AlphaRecord } from '@watr/commonlib';

export type WorkflowServiceName = keyof {
  RestPortalService: null,
  HubService: null,
  UploadIngestor: null,
  Spider: null,
  FieldExtractor: null,
  FieldBundler: null,
  MockService: null,
}

export const WorkflowServiceNames: WorkflowServiceName[] = [
  'RestPortalService',
  'HubService',
  'UploadIngestor',
  'Spider',
  'FieldExtractor',
  'FieldBundler',
  'MockService',
];

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

export function getWorkingDir(): string {
  const appSharePath = process.env['APP_SHARE_PATH'];
  const workingDir = appSharePath ? appSharePath : 'app-share.d';
  return workingDir;
}
