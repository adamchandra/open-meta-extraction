import yargs from 'yargs';
import { arglib } from '@watr/commonlib';
import { runService, WorkflowServiceNames, runServiceHub } from './workflow-services';
const { opt, config, registerCmd } = arglib;

export function registerCLICommands(yargv: yargs.Argv) {
  const hubName = 'ServiceHub';
  const orderedServices = WorkflowServiceNames;

  registerCmd(
    yargv,
    'start-service',
    'start a named service',
    config(
      opt.ion('dockerize', { boolean: true, default: false }),
      opt.ion('service-name: name of service to launch', {
        choices: orderedServices
      })
    )
  )((args: any) => {
    const { serviceName, dockerize } = args;
    runService(hubName, serviceName, dockerize);
  });

  registerCmd(
    yargv,
    'start-service-hub',
    'start the service hub',
    config(
      opt.ion('dockerize', { boolean: true, default: false }),
    )
  )((args: any) => {
    const { dockerize } = args;
    runServiceHub(hubName, dockerize, orderedServices);
  });
}
