import { WorkflowServiceName } from '~/workflow/distributed/workflow-defs';
import { pm2CliJob } from './eco-helpers';
import _ from 'lodash';

export const appNames: WorkflowServiceName[] = [
  'HubService',
  'SpiderService',
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

module.exports = {
  apps
};
