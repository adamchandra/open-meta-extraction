import _ from 'lodash';

import { delay } from '@watr/commonlib';
import winston from 'winston';
import Async from 'async';
import { newCommLink, CommLink } from './commlink';
import { CustomHandler, CustomHandlers, Message, Body, ping, quit, ack } from './message-types';

export type LifecycleName = keyof {
  startup: null,
  shutdown: null,
  step: null,
  run: null,
};

export type LifecycleHandlers<CargoT> = Record<LifecycleName, CustomHandler<SatelliteService<CargoT>>>;

export type SatelliteCommLink<CargoT> = CommLink<SatelliteService<CargoT>>;

export interface SatelliteService<CargoT> {
  serviceName: string;
  hubName: string;
  commLink: CommLink<SatelliteService<CargoT>>;
  sendHub(msg: Body): Promise<void>;
  log: winston.Logger;
  cargo: CargoT;
}

export interface SatelliteServiceDef<CargoT> {
  cargoInit: (sc: CommLink<SatelliteService<CargoT>>) => Promise<CargoT>;
  lifecyleHandlers: CustomHandlers<SatelliteService<CargoT>>;
}

export interface ServiceHub {
  name: string;
  commLink: CommLink<ServiceHub>;
  addSatelliteServices(): Promise<void>;
  shutdownSatellites(): Promise<void>;
}

export function defineSatelliteService<CargoT>(
  cargoInit: (sc: CommLink<SatelliteService<CargoT>>) => Promise<CargoT>,
  lifecyleHandlers: CustomHandlers<SatelliteService<CargoT>>
): SatelliteServiceDef<CargoT> {
  return {
    cargoInit,
    lifecyleHandlers
  };
}


export async function createSatelliteService<T>(
  hubName: string,
  satelliteName: string,
  serviceDef: SatelliteServiceDef<T>
): Promise<SatelliteService<T>> {

  const commLink: CommLink<SatelliteService<T>> = newCommLink<SatelliteService<T>>(satelliteName);

  return serviceDef
    .cargoInit(commLink)
    .then(async (cargo) => {
      const logLevel = process.env[`${satelliteName}.loglevel`]
        || process.env['service-comm.loglevel']
        || 'info';

      const satService: SatelliteService<T> = {
        ...serviceDef.lifecyleHandlers,
        serviceName: satelliteName,
        hubName,
        async sendHub(message: Body): Promise<void> {
          return commLink.send(
            Message.address(message, { from: satelliteName, to: hubName })
          );
        },
        log: commLink.log.child({
          level: logLevel
        }),
        commLink,
        cargo,
      };

      await commLink.connect();

      return satService;
    });
}

async function messageAllSatellites(
  hubComm: CommLink<ServiceHub>,
  satelliteNames: string[],
  msg: Body
): Promise<void> {
  const pinged: string[] = [];


  hubComm.on(ack(msg), async (msg: Message) => {
    hubComm.log.debug(`${hubComm.name} got ${msg.kind} from satellite ${msg.from}`);
    pinged.push(msg.from);
  });

  const allPinged = () => _.every(satelliteNames, n => pinged.includes(n));
  const unpinged = () => _.filter(satelliteNames, n => !pinged.includes(n));
  const tryPing: () => Promise<void> = async () => {
    if (allPinged()) {
      return;
    }
    const remaining = unpinged();
    hubComm.log.info(`${hubComm.name} sending ${msg.kind} to remaining satellites: ${_.join(remaining, ', ')}`);
    await Async.each(
      remaining,
      async satelliteName => hubComm.send(Message.address(msg, { to: satelliteName }))
    );

    return delay(200).then(async () => {
      return tryPing();
    });
  };
  return tryPing();
}

export async function createHubService(
  hubName: string,
  orderedServices: string[]
): Promise<[ServiceHub, () => Promise<void>]> {
  const hubService: ServiceHub = {
    name: hubName,
    commLink: newCommLink(hubName),
    async addSatelliteServices(): Promise<void> {
      await messageAllSatellites(this.commLink, orderedServices, ping);
    },
    async shutdownSatellites(): Promise<void> {
      await messageAllSatellites(this.commLink, orderedServices, quit);
    }
  };

  const connectedPromise: () => Promise<void> = () =>
    hubService.commLink.connect()
      .then(() => hubService.addSatelliteServices());

  return [hubService, connectedPromise];
}
