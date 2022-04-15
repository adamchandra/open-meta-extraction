import _ from 'lodash';

import {
  createServiceHub,
  createSatelliteService,
  SatelliteService,
  ServiceHub,
  SatelliteServiceDef,
  ServiceHubDef
} from '@watr/commlinks';

export async function runServiceHubAndSatellites(
  hubDef: ServiceHubDef,
  satelliteServiceDefs: SatelliteServiceDef<any>[]
): Promise<[ServiceHub, () => Promise<void>, SatelliteService<any>[]]> {


  const [hubService, hubConnected] = await createServiceHub(hubDef);
  const servicePromises = _.map(satelliteServiceDefs, (d) => createSatelliteService(hubDef.name, d));

  const satellites: Array<SatelliteService<any>> =
    await Promise.all(servicePromises);

  return [hubService, hubConnected, satellites];
}
