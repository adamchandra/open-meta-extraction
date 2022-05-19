import { AlphaRecord } from '@watr/commonlib';

export type WorkflowServiceName = keyof {
  HubService: null,
  WorkflowConductor: null,
  SpiderService: null,
  OpenReviewRelayService: null
};

export const WorkflowServiceNames: WorkflowServiceName[] = [
  'HubService',
  'WorkflowConductor',
  'SpiderService',
  'OpenReviewRelayService'
];

export interface RequestOneRecWorkflow {
  log: string[];
  alphaRec: AlphaRecord;
}
