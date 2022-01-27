import _ from 'lodash';

import {
  createHubService,
  createSatelliteService,
  SatelliteService,
  ServiceHub,
  SatelliteServiceDef
} from '@watr/commlinks';
import { WorkflowServiceName } from './workflow-defs';
import { registeredServices } from './workers';



// export async function runServiceHub(
//   hubName: string,
//   orderedServices: string[]
// ): Promise<[ServiceHub, () => Promise<void>]> {
//   return createHubService(hubName, orderedServices);
// }

export async function runServiceHubAndSatellites(
  hubName: string,
  satelliteServiceDefs: Record<string, SatelliteServiceDef<any>>
): Promise<[ServiceHub, () => Promise<void>, Record<string, SatelliteService<any>>]> {

  const serviceNames = _.keys(satelliteServiceDefs);

  const [hubService, hubConnected] = await createHubService(hubName, serviceNames);
  const servicePromises = _.map(serviceNames, (serviceName) => {
    return createSatelliteService(hubName, serviceName, satelliteServiceDefs[serviceName]);
  });

  const satellites: Array<[string, SatelliteService<any>]> = await Promise.all(servicePromises)
    .then((satellites) => _.map(satellites, s => [s.serviceName, s]));

  const satelliteRecords = _.fromPairs(satellites);

  return [hubService, hubConnected, satelliteRecords];
}


export async function runRegisteredService(
  hubName: string,
  serviceName: WorkflowServiceName,
): Promise<SatelliteService<any>> {
  const serviceDef = registeredServices[serviceName]
  return createSatelliteService(hubName, serviceName, serviceDef);
}
