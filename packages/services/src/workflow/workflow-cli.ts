import _ from 'lodash';
import { createSatelliteService, createServiceHub, defineServiceHub } from '@watr/commlinks';
import { arglib } from '@watr/commonlib';
import { SpiderService } from './distributed/spider-worker';
import { FieldExtractor, WorkflowConductor } from './distributed/workers';
import { OpenReviewRelayService } from './distributed/openreview-relay';
const { opt, config, registerCmd } = arglib;

export function registerCLICommands(yargv: arglib.YArgsT) {
  const availableServices = {
    WorkflowConductor,
    SpiderService,
    FieldExtractor,
    OpenReviewRelayService
  };
  const orderedServices = _.keys(availableServices);
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
  )((args: any) => {
    const { serviceName } = args;
    // return new Promise((resolve) => {
    if (orderedServices.includes(serviceName)) {
      const serviceDef  = _.get(availableServices, serviceName);
      return createSatelliteService(HubService.name, serviceDef)
        .then((service) => sigtraps(() => {
          return service.commLink.quit();
        }))
        .catch(error => {
          console.log(`Error: ${error}`)
        });
    }
    if (serviceName === HubService.name) {
      return createServiceHub(HubService)
        .then(([hubService, hubConnected]) => {
          return hubConnected()
            .then(() => sigtraps(async () => {
              await hubService.shutdownSatellites();
              await hubService.commLink.quit();
            }));
        })
        .catch(error => {
          console.log(`Error: ${error}`)
        });
    }
  });
  // });
}

async function sigtraps(cb: () => Promise<void>): Promise<void> {
  return new Promise((resolve) => {
    process.on('SIGINT', function() {
      console.log('got SIGINT')
      cb().then(resolve);
    });
    process.on('SIGTERM', function() {
      console.log('got SIGTERM')
      cb().then(resolve);
    });
  });
}
