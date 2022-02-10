import _ from 'lodash';
import { createSatelliteService, createServiceHub, defineServiceHub } from '@watr/commlinks';
import { arglib } from '@watr/commonlib';
import { SpiderService } from './distributed/spider-worker';
import { FieldExtractor, RestService, WorkflowConductor } from './distributed/workers';
const { opt, config, registerCmd } = arglib;

export function registerCLICommands(yargv: arglib.YArgsT) {
  const availableServices = {
    RestService,
    WorkflowConductor,
    SpiderService,
    FieldExtractor
  };
  const orderedServices = _.keys(availableServices) ;
  const HubService = defineServiceHub('HubService', orderedServices, [], {});

  registerCmd(
    yargv,
    'start-service',
    'start a named service',
    config(
      opt.ion('service-name: name of service to launch (or "HubService" to start hub)', {
        choices: _.concat(orderedServices, [HubService.name])
      })
    )
  )(async (args: any) => {
    const { serviceName } = args;
    if (orderedServices.includes(serviceName)) {
      const serviceDef = availableServices[serviceName];
      const service = await createSatelliteService(HubService.name, serviceDef);
      // TODO make sure promise resolves
    }
    if (serviceName === HubService.name) {

      const [hubService, hubConnected] = await createServiceHub(HubService);
      await hubConnected();
    }
    // TODO runRegisteredService(hubName, serviceName);
  });
}
