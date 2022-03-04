import { CustomHandler } from '@watr/commlinks';
import { AlphaRecord } from '@watr/commonlib';

export type WorkflowServiceName = keyof {
  RestService: null,
  HubService: null,
  WorkflowConductor: null,
  SpiderService: null,
  FieldExtractor: null,
  OpenReviewRelayService: null
}

export const WorkflowServiceNames: WorkflowServiceName[] = [
  'RestService',
  'HubService',
  'WorkflowConductor',
  'SpiderService',
  'FieldExtractor',
  'OpenReviewRelayService'
];

export interface RequestOneRecWorkflow {
  log: string[];
  alphaRec: AlphaRecord;
}

export type RequestOneRecHandler<ClientT> =
  CustomHandler<ClientT, RequestOneRecWorkflow, Promise<RequestOneRecWorkflow>>;
