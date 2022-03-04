import _ from 'lodash';

import Async from 'async';
import { defineSatelliteService, createSatelliteService, SatelliteService, ServiceHub, createServiceHub, defineServiceHub } from '~/patterns/hub-connection';
import { newCommLink, CommLink } from '~/core/commlink';
import { Message, AnyMessage, CustomHandlers, CustomHandler } from '~/core/message-types';

// export async function createTestServices<ClientT>(clients: ClientT[]): Promise<Array<CommLink<ClientT>>> {
//   const services = await Async.map<ClientT, CommLink<ClientT>, Error>(
//     clients,
//     async (client, i) => {
//       const serviceName = `service-${i}`;
//       const commLink = newCommLink<ClientT>(serviceName)
//         .withClient(client);


//       commLink.on(quit, async function(this: ClientT, _msg: Message, comm): Promise<void> {
//         await comm.quit();
//       });

//       await commLink.connect();
//       return commLink;
//     });

//   return services;
// }

interface LifecycleHandlers<T> {
  networkReady: CustomHandler<T, unknown, void>;
  startup: CustomHandler<T, unknown, void>;
  shutdown: CustomHandler<T, unknown, void>;
}

function lifeCycleHandlers<T>(): LifecycleHandlers<T> {
  return {
    async networkReady() {
    },
    async startup() {
    },
    async shutdown() {
    }
  }
}

export async function createTestServiceHub(
  n: number,
  runLog: string[]
): Promise<[ServiceHub, () => Promise<void>, Array<SatelliteService<LifecycleHandlers<void>>>]> {
  const hubName = 'ServiceHub';
  const serviceNames = _.map(_.range(n), (i) => `service-${i}`);

  const recordLogMsgHandler = (svcName: string) => async (msg: Message) => {
    const packed = Message.pack(msg);

    const { from, to, kind } = msg;
    // const logmsg = `${svcName}: ${packed}`;
    const logmsg = `${from} -[${kind}]-> ${to}`;
    runLog.push(logmsg);
  };

  const satelliteServices = await Async.map<string, SatelliteService<LifecycleHandlers<void>>, Error>(
    serviceNames,
    async (serviceName: string) => {
      const serviceDef = defineSatelliteService<LifecycleHandlers<void>>(
        serviceName,
        async () => { return lifeCycleHandlers() },
      );

      const satService = await createSatelliteService(hubName, serviceDef);

      satService.commLink.on(AnyMessage, async (msg: Message) => {
        recordLogMsgHandler(serviceName)(msg);
      });
      return satService;
    });

  const hubService = defineServiceHub(hubName, serviceNames, [], {});

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

export async function initCommLinks<ClientT extends CustomHandlers<ClientT>>(n: number, clientN: (i: number) => ClientT): Promise<CommLink<ClientT>[]> {
  const commNames = _.map(_.range(n), (i) => `commLink-${i}`);
  const commLinks = _.map(
    commNames, (name, i) => {
      return newCommLink<ClientT>(name).withMethods(clientN(i))
    });

  return await Promise.all(_.map(commLinks, async (commLink) => {
    return commLink.connect().then(() => commLink);
  }));
}

export async function awaitQuit<A>(commLinks: CommLink<A>[]): Promise<void> {
  await Promise.all(_.map(commLinks, (commLink) => commLink.quit()));
}
