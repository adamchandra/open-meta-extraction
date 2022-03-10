import { WorkflowServiceName } from "~/workflow/distributed/workflow-defs";

function appDef(name: string): Record<string, any> {
  return {
    name,
    script: "./dist/src/cli/index.js",
    args: `start-service --service-name=${name}`,
    env_testing: {
      NODE_ENV: "testing"
    },
    env_development: {
      NODE_ENV: "development"
    },
    env_production: {
      NODE_ENV: "production"
    }
  };
}

export const appNames: WorkflowServiceName[] = [
  'HubService',
  'WorkflowConductor',
  'SpiderService',
  'FieldExtractor',
  'OpenReviewRelayService'
];

const apps = appNames.map(name => appDef(name));

module.exports = {
  apps
};
