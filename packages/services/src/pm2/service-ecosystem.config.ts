import { WorkflowServiceName } from '~/workflow/distributed/workflow-defs';
import { appDef } from './eco-helpers';

export const appNames: WorkflowServiceName[] = [
  'HubService',
  'WorkflowConductor',
  'SpiderService',
  'FieldExtractor',
  'OpenReviewRelayService'
];

const script = './dist/src/cli/index.js'

const apps = appNames.map(name => appDef(name, script, `start-service --service-name=${name}`));

module.exports = {
  apps
};
