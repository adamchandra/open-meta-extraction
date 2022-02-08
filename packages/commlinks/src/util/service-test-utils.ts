import _ from 'lodash';
import Async from 'async';
import { defineSatelliteService, createSatelliteService, SatelliteService, ServiceHub, createServiceHub, defineServiceHub } from '~/patterns/hub-connection';
import { newCommLink, CommLink } from '~/core/commlink';
import { Message, quit, AnyMessage } from '~/core/message-types';

export interface TestService<ClientT> {
  commLink: CommLink<ClientT>;
}

export async function createTestServices<ClientT>(clients: ClientT[]): Promise<Array<TestService<ClientT>>> {

  const indexedClients = _.zip(clients, _.range(clients.length));
  const services = await Async.map<[ClientT, number], TestService<ClientT>, Error>(
    indexedClients,
    async ([client, i]) => {
      const serviceName = `service-${i}`;
      const service: TestService<ClientT> = {
        commLink: newCommLink(serviceName, client),
      };

      service.commLink.on(quit, async (_msg: Message) => {
        await this.commLink.quit();
      });

      await service.commLink.connect();
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
  };

  const satelliteServices = await Async.map<string, SatelliteService<void>, Error>(
    serviceNames,
    async (serviceName: string) => {
      const serviceDef = defineSatelliteService<void>(
        serviceName,
        async () => { }, {
        async run() {
          this.log.info(`${this.serviceName} [run]> payload=??? `);
        },
        async networkReady() {
        },
        async startup() {
        },
        async shutdown() {
        },
      });

      const satService = await createSatelliteService(hubName, serviceDef);

      satService.commLink.on(AnyMessage, async (msg: Message) => {
        recordLogMsgHandler(serviceName)(msg);
      });
      return satService;
    });

  const hubService = defineServiceHub(hubName, serviceNames, []);

  const [hubPool, connectHub] = await createServiceHub(hubService);

  hubPool.commLink.on(AnyMessage, async (msg: Message) => {
    recordLogMsgHandler(hubPool.name)(msg);
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
  });
  return atLeastOneMatchPerRegexp;
}

export async function initCommLinks<ClientT>(n: number, clientN: (i: number) => ClientT): Promise<CommLink<ClientT>[]> {
  const commNames = _.map(_.range(n), (i) => `commLink-${i}`);
  const commLinks = _.map(commNames, (name, i) => newCommLink(name, clientN(i)));
  return await Promise.all(_.map(commLinks, async (commLink) => {
    return commLink.connect().then(() => commLink);
  }));
}

export async function awaitQuit<A>(commLinks: CommLink<A>[]): Promise<void> {
  await Promise.all(_.map(commLinks, (commLink) => commLink.quit()));
}
