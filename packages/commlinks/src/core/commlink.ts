import _, { keyBy } from 'lodash';
import Redis from 'ioredis';
import winston from 'winston';
import { getServiceLogger, newIdGenerator, prettyFormat } from '@watr/commonlib';

import Async from 'async';

import {
  Message,
  MessageHandler,
  MessageHandlerDef,
  creturn,
  matchMessageToQuery,
  MessageQuery,
  addHeaders,
  ping,
  ack,
  quit,
  mergeMessages,
  MessageHandlerFunc,
  myield,
  mreturn,
  mcall,
  Body,
  Headers,
  CYield,
} from './message-types';

import { newRedisClient } from './ioredis-conn';

export const nextMessageId = newIdGenerator(1);

const getAllMethods = (obj: object) => {
  let props: string[] = []

  do {
    const l: string[] = Object.getOwnPropertyNames(obj)
      .concat(Object.getOwnPropertySymbols(obj).map(s => s.toString()))
      .sort()
      .filter((p, i, arr) =>
        // typeof obj[p] === 'function' &&  //only the methods
        typeof _.get(obj, p) === 'function' &&  //only the methods
        p !== 'constructor' &&           //not the constructor
        (i == 0 || p !== arr[i - 1]) &&  //not overriding in this prototype
        props.indexOf(p) === -1          //not overridden in a child
      )
    props = props.concat(l)
  }
  while (
    (obj = Object.getPrototypeOf(obj)) &&   //walk-up the prototype chain
    Object.getPrototypeOf(obj)              //not the the Object prototype methods (hasOwnProperty, etc...)
  )

  return props
}

export interface CommLink<ClientT> {
  name: string;
  client?: ClientT;
  log: winston.Logger;

  // Handle a builtin message
  on(m: MessageQuery, h: MessageHandlerFunc<ClientT, Message>): void;
  once(m: MessageQuery, h: MessageHandlerFunc<ClientT, Message>): void;
  send(message: Body & Partial<Headers>): Promise<void>;

  // Invoke a client installed function, either locally or on another node over the wire
  call<A, B>(f: string, a: A, hdrs?: Partial<Headers>): Promise<B>;
  quit(): Promise<void>;

  withMethods(handlers: ClientT): CommLink<ClientT>;
  connect(): Promise<void>;

  // Internal use:
  _install(m: MessageQuery, h: MessageHandlerFunc<ClientT, Message>, once: boolean): void;
  subscriber: Redis;
  messageHandlers: MessageHandlerDef<ClientT>[];
  methodHandlers: Partial<ClientT>;
  isShutdown: boolean;
}

async function runMessageHandlers<ClientT>(
  message: Message,
  packedMsg: string,
  commLink: CommLink<ClientT>,
  client: Partial<ClientT>,
): Promise<void> {

  commLink.log.silly(`finding message handlers for ${packedMsg}`);

  const matchedHandlers = _.filter(commLink.messageHandlers, ([handlerKind, handler]) => {
    const matches = matchMessageToQuery(handlerKind, message);
    const hpf = prettyFormat(handlerKind);
    const matchMsg = matches ? 'yes' : 'no';
    commLink.log.silly(`match:${matchMsg} ~= ${hpf}? `);
    handler.didRun = matches;
    return matches;
  });

  switch (message.kind) {
    case 'call': {
      const { func, arg, id, from } = message;
      commLink.log.verbose(`Call Attempt ${commLink.name}.${func}(${prettyFormat(arg)})`)

      const clientMethods = getAllMethods(client);
      // client.func
      const maybeCallback = _.get(client, func);

      if (maybeCallback === undefined) {
        const keys = _.keys(client);
        const kstr = keys.join(', ');
        // TODO control whether non-existent client funcs trigger warning/error
        commLink.log.verbose(`Undefined Func ${commLink.name}.${func}(...); keys are ${kstr}`);
        break
      }
      if (typeof maybeCallback === 'function') {
        commLink.log.verbose(`Calling ${commLink.name}.${func}(...)`)
        const cb = _.bind(maybeCallback, client);
        const newA = await Promise.resolve(cb(arg, commLink));
        const yieldMsg: CYield = myield(func, newA, from);
        await commLink.send(Message.address(yieldMsg, { id, to: commLink.name }));
      }
      break;
    }
    case 'cyield': {
      const { func, id, callFrom } = message;
      let currMsg = message;

      commLink.log.silly(`running ${matchedHandlers.length} handlers`);
      await Async.eachOfSeries(matchedHandlers, async ([handlerKind, handler], i) => {
        commLink.log.silly(`running handler#${i}`);

        const hk = prettyFormat(handlerKind);
        commLink.log.silly(`running handler ${hk} for ${packedMsg}`);
        const bh = _.bind(handler.run, client);
        const maybeNewValue = await bh(currMsg, commLink);
        const newV = prettyFormat(maybeNewValue);
        commLink.log.silly(`handler returned ${prettyFormat(newV)}`);
        if (maybeNewValue !== undefined) {
          currMsg = maybeNewValue
        }
      });
      const returnMsg = Message.address(mreturn(func, currMsg.result), { id, to: callFrom });
      await commLink.send(returnMsg);
      break;
    }
    default: {
      _.each(matchedHandlers, async ([handlerKind, handler]) => {
        const hk = prettyFormat(handlerKind);
        commLink.log.silly(`running handler ${hk} for ${packedMsg}`);
        const bh = _.bind(handler.run, client);
        const mod = await bh(message, commLink);
        return mod;
      });
      break;
    }
  }

  const activeHandlers = _.filter(commLink.messageHandlers, ([, mh]) => {
    const stale = mh.didRun && mh.once;
    return !stale;
  });
  commLink.messageHandlers = activeHandlers;
}

export function newCommLink<ClientT>(
  name: string
): CommLink<ClientT> {

  const commLink: CommLink<ClientT> = {
    name,
    // client,
    subscriber: newRedisClient(name),
    isShutdown: false,
    log: getServiceLogger(`${name}/comm`),
    messageHandlers: [],
    methodHandlers: {},

    async call<A, B>(f: string, a: A, hdrs: Partial<Headers> = {}): Promise<B> {
      const self = this;

      const to = hdrs.to !== undefined ? hdrs.to : name;
      const from = name;
      const id = hdrs.id !== undefined ? hdrs.id : nextMessageId();
      // call remote function
      const callMessage = Message.address(mcall(f, a), { to, from, id });

      const expectedReturn = mergeMessages(creturn(f), { id });
      const returnP = new Promise<B>((resolve, reject) => {
        self.once(expectedReturn, async (msg: Message) => {
          if (msg.kind !== 'creturn') {
            reject(new Error('unexpected message type'));
            return;
          }
          const bvalue: B = msg.result as B;
          resolve(bvalue);
        });
      });
      await this.send(callMessage);
      return returnP;
    },

    async connect(): Promise<void> {
      const self = this;

      return new Promise((resolve, reject) => {
        self.subscriber.on('message', (channel: string, packedMsg: string) => {
          self.log.verbose(`${name} received> ${packedMsg} on ${channel}`);
          const message = Message.unpack(packedMsg);
          runMessageHandlers<ClientT>(message, packedMsg, commLink, self.methodHandlers);
        });

        self.subscriber.subscribe(`${name}`)
          .then(() => self.log.verbose(`${name}> connected`))
          .then(() => resolve())
          .catch((error: any) => {
            const msg = `subscribe> ${error}`;
            reject(new Error(msg));
          });
      });
    },

    withMethods(handlers: ClientT): CommLink<ClientT> {
      this.methodHandlers = handlers;
      return this;
    },

    async send(msg: Body & Partial<Headers>): Promise<void> {
      const from = name;
      const to = msg.to !== undefined ? msg.to : name;
      const id = msg.id !== undefined && msg.id > 0 ? msg.id : nextMessageId();
      const finalMsg = _.merge({}, msg, { from, to, id });
      const packedMsg = Message.pack(finalMsg);

      if (this.isShutdown) {
        this.log.warn(`${name}> shutdown; not sending message ${packedMsg}`);
        return;
      }

      const publisher = this.subscriber.duplicate();
      await publisher.publish(to, packedMsg);
      this.log.verbose(`publishing ${packedMsg}`);
      await publisher.quit();
    },


    on(m: MessageQuery, h: MessageHandlerFunc<ClientT, Message>): void {
      this._install(m, h, false);
    },
    once(m: MessageQuery, h: MessageHandlerFunc<ClientT, Message>): void {
      this._install(m, h, true);
    },

    _install(m: MessageQuery, h: MessageHandlerFunc<ClientT, Message>, once: boolean): void {
      const mh: MessageHandler<ClientT, Message> = ({
        didRun: false,
        once,
        run(this: ClientT, msg: Message, commLink: CommLink<ClientT>): Promise<Message | void> {
          const bf = _.bind(h, this);
          return bf(msg, commLink)
        }
      });
      this.messageHandlers.push([m, mh]);
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

  commLink.on(ping, async (msg: Message) => {
    const reply = addHeaders(ack(msg), { from: msg.to, to: msg.from, id: msg.id });
    await commLink.send(reply);
  });

  commLink.on(quit, async (msg: Message) => {
    const reply = addHeaders(ack(msg), { from: msg.to, to: msg.from, id: msg.id });
    await commLink.send(reply);
    await commLink.quit();
  });

  return commLink;
}
