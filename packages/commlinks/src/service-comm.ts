import _ from 'lodash';
import Redis from 'ioredis';
import Async from 'async';
import winston from 'winston';
import { getServiceLogger, newIdGenerator } from '@watr/commonlib';
import {
  MessageHandlers,
  DispatchHandlers,
  Message,
  Thunk,
  Push,
  MessageBody,
  Address,
  MessageHandlerRec,
  MessageHandler,
  Yield,
} from './service-defs';

import { newRedis } from './ioredis-conn';

export interface ServiceComm<T> {
  name: string;
  log: winston.Logger;
  addHandlers(m: MessageHandlerRec<T>): void;
  addHandler(pattern: string, h: MessageHandler<T>): void;
  addDispatches(d: DispatchHandlers<T>): void;
  send(message: Message): Promise<void>;
  push(message: Message | MessageBody): Promise<void>;
  yield<A>(a: A): Promise<A>;
  connect(serviceT: T): Promise<void>;
  quit(): Promise<void>;

  // Internal use:
  subscriber: Redis.Redis;
  messageHandlers: MessageHandlers<T>;
  dispatchHandlers: DispatchHandlers<T>;
  isShutdown: boolean;
}


function getMessageHandlers<T>(
  message: Message,
  packedMsg: string,
  serviceComm: ServiceComm<T>,
  serviceT: T
): Thunk[] {
  const { messageHandlers } = serviceComm;

  serviceComm.log.silly(`finding message handlers for ${packedMsg}`);

  const handlers = _.flatMap(messageHandlers, ([handlerKey, handler]) => {
    const keyMatches = packedMsg.match(handlerKey);
    if (keyMatches !== null) {
      serviceComm.log.silly(`found message handler ${handlerKey} for ${packedMsg}`);
      const bh = _.bind(handler, serviceT);
      return [() => bh(message)];
    }
    return [];
  });

  return handlers;
}

const nextId = newIdGenerator(1);

export function newServiceComm<This>(name: string): ServiceComm<This> {
  const serviceComm: ServiceComm<This> = {
    name,
    subscriber: newRedis(name),
    isShutdown: false,
    log: getServiceLogger(`${name}/comm`),
    messageHandlers: [],
    dispatchHandlers: {},
    async push(msg: Message | MessageBody): Promise<void> {
      const id = 'id' in msg ? msg.id : 0;
      this.send(
        Address(
          Push(msg), { from: name, to: name, id }
        )
      );
    },
    async yield<A>(a: A): Promise<A> {
      const self = this;
      const yieldId = nextId();
      const toYield = Address(Yield(a), { id: yieldId, from: name, to: name });

      const responseP = new Promise<A>((resolve) => {
        self.addHandler(
          `${yieldId}:.*:${this.name}>yielded`,
          async (msg: Message) => {
            if (msg.kind !== 'yielded') return;
            resolve(msg.value);
          });
      });
      this.send(toYield);

      return responseP;
    },

    async send(msg: Message): Promise<void> {
      const addr = Address(
        msg, { from: name }
      );
      const packedMsg = Message.pack(addr);

      if (this.isShutdown) {
        this.log.warn(`${name}> shutdown; not sending message ${packedMsg}`);
        return;
      }
      const { to } = msg;

      const publisher = this.subscriber.duplicate();
      await publisher.publish(to, packedMsg);
      this.log.verbose(`publishing ${packedMsg}`);
      await publisher.quit();
    },

    addDispatches(dispatches: DispatchHandlers<This>): void {
      const all = {
        ...this.dispatchHandlers,
        ...dispatches,
      };
      this.dispatchHandlers = all;
    },

    addHandlers(messageHandlers: MessageHandlerRec<This>): void {
      const pairs = _.toPairs(messageHandlers);
      this.messageHandlers.push(...pairs);
    },

    addHandler(pattern: string, h: MessageHandler<This>): void {
      this.messageHandlers.push([pattern, h]);
    },

    async connect(serviceT: This): Promise<void> {
      const self = this;

      return new Promise((resolve, reject) => {
        const { subscriber } = self;
        const { log } = self;

        subscriber.on('message', (channel: string, packedMsg: string) => {
          log.verbose(`${name} received> ${packedMsg}`);

          const message = Message.unpack(packedMsg);

          const handlersForMessage = getMessageHandlers<This>(message, packedMsg, serviceComm, serviceT);

          Async.mapSeries(handlersForMessage, async (handler: Thunk) => handler())
            .catch((error) => {
              log.warn(`> ${packedMsg} on ${channel}: ${error}`);
            });
        });

        subscriber.subscribe(`${name}`)
          .then(() => log.info(`${name}> connected`))
          .then(() => resolve())
          .catch((error: any) => {
            const msg = `subscribe> ${error}`;
            reject(new Error(msg));
          });
      });
    },
    async quit(): Promise<void> {
      const self = this;
      return new Promise((resolve) => {
        self.subscriber.on('end', () => resolve());
        self.isShutdown = true;
        self.subscriber.quit();
      });
    }
  };

  return serviceComm;
}
