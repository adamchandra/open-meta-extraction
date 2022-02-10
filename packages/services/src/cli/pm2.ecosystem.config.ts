module.exports = {
  apps: [
    {
      name: "RestService",
      script: "./dist/src/cli/index.js",
      args: "start-service --service-name=RestService"
    },
    {
      name: "WorkflowConductor",
      script: "./dist/src/cli/index.js",
      args: "start-service --service-name=WorkflowConductor"
    },
    {
      name: "SpiderService",
      script: "./dist/src/cli/index.js",
      args: "start-service --service-name=SpiderService"
    },
    {
      name: "FieldExtractor",
      script: "./dist/src/cli/index.js",
      args: "start-service --service-name=FieldExtractor"
    },
    {
      name: "HubService",
      script: "./dist/src/cli/index.js",
      args: "start-service --service-name=HubService"
    },
  ]
};
