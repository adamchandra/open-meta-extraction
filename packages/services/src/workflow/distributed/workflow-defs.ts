import { CustomHandler } from '@watr/commlinks';
import { AlphaRecord } from '@watr/commonlib';

export type WorkflowServiceName = keyof {
  RestPortalService: null,
  HubService: null,
  WorkflowConductor: null,
  Spider: null,
  FieldExtractor: null,
  FieldBundler: null,
  MockService: null,
}

export const WorkflowServiceNames: WorkflowServiceName[] = [
  'RestPortalService',
  'HubService',
  'WorkflowConductor',
  'Spider',
  'FieldExtractor',
  'FieldBundler',
  'MockService',
];

export interface RequestOneRecWorkflow {
  log: string[];
  alphaRec: AlphaRecord;
}

export type RequestOneRecHandler<ClientT> =
  CustomHandler<ClientT, RequestOneRecWorkflow, Promise<RequestOneRecWorkflow>>;
