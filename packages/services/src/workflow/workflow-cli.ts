import { arglib } from '@watr/commonlib';
import { runRegisteredService, runServiceHub, WorkflowServiceNames  } from './distributed-workflow';
const { opt, config, registerCmd } = arglib;

export function registerCLICommands(yargv: arglib.YArgsT) {
  const hubName = 'ServiceHub';
  const orderedServices = WorkflowServiceNames;

  registerCmd(
    yargv,
    'start-service',
    'start a named service',
    config(
      opt.ion('service-name: name of service to launch', {
        choices: orderedServices
      })
    )
  )((args: any) => {
    const { serviceName } = args;
    runRegisteredService(hubName, serviceName);
  });

  registerCmd(
    yargv,
    'start-service-hub',
    'start the service hub',
  )(() => {
    runServiceHub(hubName, orderedServices);
  });
}
