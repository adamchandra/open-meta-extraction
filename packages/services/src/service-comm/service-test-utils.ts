import _ from 'lodash';
import { defineSatelliteService, createSatelliteService, SatelliteService, ServiceHub, createHubService } from './service-hub';
import Async from 'async';
import { newServiceComm, ServiceComm } from './service-comm';
import { Message } from './service-defs';

// Create a Hub/Satellite service network with specified # of satellites
export interface TestService {
  commLink: ServiceComm<TestService>;
}

export async function createTestServices(n: number): Promise<Array<TestService>> {
  const serviceNames = _.map(_.range(n), (i) => `service-${i}`);

  const services = await Async.map<string, TestService, Error>(
    serviceNames,
    async (serviceName) => {
      const service: TestService = {
        commLink: newServiceComm(serviceName),
      };

      service.commLink.addHandlers({
        async quit() {
          await this.commLink.quit();
        }
      });

      await service.commLink.connect(service);
      return service;
    });

  return services;
}


export async function createTestServiceHub(
  n: number,
  runLog: string[]
): Promise<[ServiceHub, () => Promise<void>, Array<SatelliteService<void>>]> {
  const hubName = 'ServiceHub';
  const serviceNames = _.map(_.range(n), (i) => `service-${i}`);

  const recordLogMsgHandler = (svcName: string) => async (msg: Message) => {
    const packed = Message.pack(msg);
    const logmsg = `${svcName}: ${packed}`;
    runLog.push(logmsg);
  }

  const satelliteServices = await Async.map<string, SatelliteService<void>, Error>(
    serviceNames,
    async (serviceName) => {
      const serviceDef = defineSatelliteService<void>(
        async () => undefined, {
          async run() {
            this.log.info(`${this.serviceName} [run]> payload=??? `)
          },
      });

      const satService = await createSatelliteService(hubName, serviceName, serviceDef);
      satService.commLink.addHandlers( {
        async '.*'(msg) {
          recordLogMsgHandler(serviceName)(msg)
        }
      });
      return satService;
    });

  const [hubPool, connectHub] = await createHubService(hubName, serviceNames);

  hubPool.commLink.addHandlers( {
    async '.*'(msg) {
      recordLogMsgHandler(hubPool.name)(msg);
    }
  });

  return [hubPool, connectHub, satelliteServices];
}

export function assertAllStringsIncluded(expectedStrings: string[], actualStrings: string[]): boolean {
  const atLeastOneMatchPerRegexp = _.every(expectedStrings, (str) => {
    const someMatch = _.some(actualStrings, actual => {
      return actual.includes(str);
    });
    if (!someMatch) {
      console.log('NO Matching Entry for', str);
    }
    return someMatch;
  })
  return atLeastOneMatchPerRegexp;
}
