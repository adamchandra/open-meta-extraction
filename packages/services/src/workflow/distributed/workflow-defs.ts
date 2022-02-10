import { CustomHandler } from '@watr/commlinks';
import { AlphaRecord } from '@watr/commonlib';

export type WorkflowServiceName = keyof {
  RestService: null,
  HubService: null,
  WorkflowConductor: null,
  Spider: null,
  FieldExtractor: null,
}

export const WorkflowServiceNames: WorkflowServiceName[] = [
  'RestService',
  'HubService',
  'WorkflowConductor',
  'Spider',
  'FieldExtractor',
];

export interface RequestOneRecWorkflow {
  log: string[];
  alphaRec: AlphaRecord;
}

export type RequestOneRecHandler<ClientT> =
  CustomHandler<ClientT, RequestOneRecWorkflow, Promise<RequestOneRecWorkflow>>;
