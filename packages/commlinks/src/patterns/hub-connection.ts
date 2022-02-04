import _ from 'lodash';

import { delay, getLogEnvLevel, prettyFormat } from '@watr/commonlib';
import winston from 'winston';
import Async from 'async';
import { newCommLink, CommLink } from '~/core/commlink';
import { CustomHandler, CustomHandlers, Message, Body, ping, quit, ack, call, Ping, Quit } from '~/core/message-types';
import { initCallChaining, CallChainDef } from './chain-connection';

export type LifecycleName = keyof {
  startup: null,
  shutdown: null,
};

export type LifecycleHandlers<CargoT> = Record<LifecycleName, CustomHandler<SatelliteService<CargoT>>>;
export type SatelliteCommLink<CargoT> = CommLink<SatelliteService<CargoT>>;

export interface SatelliteServiceDef<CargoT> {
  name: string;
  cargoInit: (sc: CommLink<SatelliteService<CargoT>>) => Promise<CargoT>;
  lifecycleHandlers: CustomHandlers<SatelliteService<CargoT>>;
}

export interface SatelliteService<CargoT> {
  serviceName: string;
  hubName: string;
  commLink: CommLink<SatelliteService<CargoT>>;
  sendHub(msg: Body): Promise<void>;
  log: winston.Logger;
  cargo: CargoT;
}


export interface ServiceHubDef {
  name: string;
  satelliteNames: string[];
  callChainDefs: CallChainDef[];
  lifecycleHandlers: CustomHandlers<ServiceHub>;
}
export interface ServiceHub {
  name: string;
  commLink: CommLink<ServiceHub>;
  satelliteNames: string[];
  callChainDefs: CallChainDef[];
  messageAll(body: Body): Promise<void>;
  addSatelliteServices(): Promise<void>;
  shutdownSatellites(): Promise<void>;
}


export function defineServiceHub(
  name: string,
  satelliteNames: string[],
  callChainDefs: CallChainDef[],
  lifecycleHandlers: CustomHandlers<ServiceHub> = {}
): ServiceHubDef {
  return {
    name,
    satelliteNames,
    callChainDefs,
    lifecycleHandlers
  };
}

export async function createServiceHub(
  hubDef: ServiceHubDef,
): Promise<[ServiceHub, () => Promise<void>]> {
  const { name, satelliteNames, callChainDefs } = hubDef;
  const hubService: ServiceHub = {
    name,
    satelliteNames,
    callChainDefs,
    commLink: newCommLink(name),
    async messageAll(body: Body): Promise<void> {
      await messageAll(this.commLink, this.satelliteNames, body);
    },
    async addSatelliteServices(): Promise<void> {
      return pingOrQuitAll(this.commLink, this.satelliteNames, ping);
    },
    async shutdownSatellites(): Promise<void> {
      await this.messageAll(call('shutdown'))
      return pingOrQuitAll(this.commLink, this.satelliteNames, quit);
    }
  };

  const connectedPromise: () => Promise<void> = () =>
    hubService.commLink.connect()
      .then(() => hubService.addSatelliteServices());

  return [hubService, connectedPromise];
}


export function defineSatelliteService<CargoT>(
  name: string,
  cargoInit: (sc: CommLink<SatelliteService<CargoT>>) => Promise<CargoT>,
  lifecycleHandlers: CustomHandlers<SatelliteService<CargoT>>
): SatelliteServiceDef<CargoT> {
  return {
    name,
    cargoInit,
    lifecycleHandlers
  };
}

export async function createSatelliteService<T>(
  hubName: string,
  serviceDef: SatelliteServiceDef<T>
): Promise<SatelliteService<T>> {
  const satelliteName = serviceDef.name;

  const commLink: CommLink<SatelliteService<T>> = newCommLink<SatelliteService<T>>(satelliteName);

  return serviceDef
    .cargoInit(commLink)
    .then(async (cargo) => {
      const logLevel = getLogEnvLevel();

      const lifecycleHandlers = {
        ...serviceDef.lifecycleHandlers,
        initCallChaining,
      }

      const satService: SatelliteService<T> = {
        ...lifecycleHandlers,
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

      await commLink.connect(satService);

      return satService;
    });
}

async function pingOrQuitAll(
  hubComm: CommLink<ServiceHub>,
  satelliteNames: string[],
  msg: Ping | Quit
): Promise<void> {
  const pinged: string[] = [];

  // TODO make this .once()
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

async function messageAll(
  hubComm: CommLink<ServiceHub>,
  satelliteNames: string[],
  msg: Body
): Promise<void> {


  hubComm.log.info(`${hubComm.name} broadcasting ${prettyFormat(msg)} to ${_.join(satelliteNames, ', ')}`);
  await Async.each(
    satelliteNames,
    async satelliteName => hubComm.send(Message.address(msg, { to: satelliteName }))
  );


}
