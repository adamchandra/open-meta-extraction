import _ from 'lodash';

import { delay, getLogEnvLevel, prettyFormat } from '@watr/commonlib';
import winston from 'winston';
import Async from 'async';
import { newCommLink, CommLink, nextMessageId } from '~/core/commlink';
import { CustomHandler, CustomHandlers, Message, Body, ping, quit, ack, creturn, MessageQuery, mcall, addHeaders } from '~/core/message-types';

import { initCallChaining, CallChainDef } from './chain-connection';

export type LifecycleName = keyof {
  networkReady: null,
  startup: null,
  shutdown: null,
};

export type LifecycleHandlers<ClientT> = Record<LifecycleName, CustomHandler<ClientT, Message, void>>;
export type SatelliteHandlers<ClientT> =
  CustomHandlers<ClientT>
  & LifecycleHandlers<ClientT>;

export type SatelliteCommLink<CargoT> = CommLink<SatelliteService<CargoT>>;

export interface SatelliteServiceDef<CargoT> {
  name: string;
  cargoInit: (sc: CommLink<SatelliteService<CargoT>>) => Promise<CargoT>;
  // lifecycleHandlers: SatelliteHandlers<CargoT>;
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

  addSatelliteServices(): Promise<void>;
  shutdownSatellites(): Promise<void>;
}

export function defineServiceHub(
  name: string,
  satelliteNames: string[],
  callChainDefs: CallChainDef[],
  lifecycleHandlers: CustomHandlers<ServiceHub>
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
    async addSatelliteServices(): Promise<void> {
      await pingAndAwait(this.commLink, this.satelliteNames)
      await callAndAwait(this.commLink, this.satelliteNames, 'networkReady', false);
      await callAndAwait(this.commLink, this.satelliteNames, 'startup', false);
    },
    async shutdownSatellites(): Promise<void> {
      await callAndAwait(this.commLink, this.satelliteNames, 'shutdown', false);
      return quitAndAwait(this.commLink, this.satelliteNames);
    },
  };

  const connectedPromise: () => Promise<void> = () =>
    hubService.commLink
      .withMethods(hubService)
      .connect()
      .then(() => hubService.addSatelliteServices());

  return [hubService, connectedPromise];
}

export function defineSatelliteService<CargoT>(
  name: string,
  cargoInit: (sc: CommLink<SatelliteService<CargoT>>) => Promise<CargoT>,
): SatelliteServiceDef<CargoT> {
  return {
    name,
    cargoInit,
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
        ...cargo,
        initCallChaining,
      }

      const satService: SatelliteService<T> = {
        ...lifecycleHandlers,
        serviceName: satelliteName,
        hubName,
        async sendHub(body: Body): Promise<void> {
          return commLink.send(
            Message.address(body, { from: satelliteName, to: hubName })
          );
        },
        log: commLink.log.child({
          level: logLevel
        }),
        commLink,
        cargo,
      };

      await commLink.withMethods(satService)
        .connect();

      return satService;
    });
}

async function pingAndAwait(hubComm: CommLink<ServiceHub>, satelliteNames: string[]): Promise<void> {
  return messageAndAwait(hubComm, satelliteNames, ping, ack(ping), true)
}
async function quitAndAwait(hubComm: CommLink<ServiceHub>, satelliteNames: string[]): Promise<void> {
  return messageAndAwait(hubComm, satelliteNames, quit, ack(quit), true)
}

async function callAndAwait(
  hubComm: CommLink<ServiceHub>,
  satelliteNames: string[],
  func: string,
  retrySend: boolean
): Promise<void> {
  return messageAndAwait(hubComm, satelliteNames, mcall(func, {}), creturn(func), retrySend)
}

async function messageAndAwait(
  hubComm: CommLink<ServiceHub>,
  satelliteNames: string[],
  body: Body,
  waitQuery: MessageQuery,
  retrySend: boolean
): Promise<void> {
  const answered: string[] = [];

  const allAnswered = () => _.every(satelliteNames, n => answered.includes(n));
  const unanswered = () => _.filter(satelliteNames, n => !answered.includes(n));
  let iterNum = 0;

  const tryPing: () => Promise<void> = async () => {
    const isFirstPing = iterNum === 0;
    // const pingTimeout = retrySend ? 500 : 5000;
    const pingTimeout =  500;

    if (allAnswered()) {
      hubComm.log.info(`Done: ${hubComm.name} received all ${prettyFormat(body)}`);
      return;
    }
    const remaining = unanswered();
    if (isFirstPing) {
      hubComm.log.info(`${hubComm.name} sending ${prettyFormat(body)} to remaining satellites: ${_.join(remaining, ', ')}`);
    }

    if (retrySend || iterNum === 0) {
      iterNum += 1;

      await Async.each(
        remaining,
        async satelliteName => {
          const nextId = nextMessageId()
          const waitFor = addHeaders(waitQuery, { id: nextId });

          hubComm.on(waitFor, async (msg: Message) => {
            hubComm.log.debug(`${hubComm.name} got ${msg.kind} from satellite ${msg.from}`);
            answered.push(msg.from);
          });

          return hubComm.send(Message.address(body, { id: nextId, to: satelliteName }))
        });
    }

    return delay(pingTimeout).then(async () => {
      return tryPing();
    });
  };
  return tryPing();
}
