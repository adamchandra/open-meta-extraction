import { WorkflowServiceName } from '~/workflow/distributed/workflow-defs';
import { pm2CliJob } from './eco-helpers';
import _ from 'lodash';
import { prettyPrint } from '@watr/commonlib';

export const appNames: WorkflowServiceName[] = [
  'HubService',
  'WorkflowConductor',
  'SpiderService',
  'FieldExtractor',
  'OpenReviewRelayService'
];


const apps1 = appNames.map(name => {
  return pm2CliJob('start-service', { name, args: `--service-name=${name}` });
});

const apps2 = [
  pm2CliJob('scheduler'),
  pm2CliJob('preflight-check', { autorestart: false })
];

const apps = _.concat(apps1, apps2)

prettyPrint({ apps });

module.exports = {
  apps
};
