import _ from 'lodash';
import Redis from 'ioredis';
import winston from 'winston';
import { getServiceLogger, newIdGenerator, prettyFormat } from '@watr/commonlib';

import Async from 'async';

import {
  Message,
  MessageHandler,
  MessageHandlerDef,
  creturn,
  cyield,
  matchMessageToQuery,
  MessageQuery,
  addHeaders,
  ping,
  ack,
  quit,
  call,
  ToHeader,
  mergeMessages,
  MessageHandlerFunc
} from './message-types';

import { newRedisClient } from './ioredis-conn';

const nextId = newIdGenerator(1);

export interface CommLink<ClientT> {
  name: string;
  client?: ClientT;
  log: winston.Logger;

  // Handle a builtin message
  on(m: MessageQuery, h: MessageHandlerFunc<ClientT, Message>): void;
  once(m: MessageQuery, h: MessageHandlerFunc<ClientT, Message>): void;
  send(message: Message): Promise<void>;

  // Invoke a client installed function, either locally or on another node over the wire
  call<A, B>(f: string, a: A, to?: ToHeader): Promise<B>;
  connect(client?: ClientT): Promise<void>;
  quit(): Promise<void>;

  // Internal use:
  _install(m: MessageQuery, h: MessageHandlerFunc<ClientT, Message>, once: boolean): void;
  subscriber: Redis.Redis;
  messageHandlers: MessageHandlerDef<ClientT>[];
  isShutdown: boolean;
}

async function runMessageHandlers<ClientT>(
  message: Message,
  packedMsg: string,
  commLink: CommLink<ClientT>,
  client: ClientT
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
      if (client === undefined) {
        // TODO control whether non-existent client funcs trigger warning/error
        commLink.log.verbose(`Undefined Client: ${commLink.name}.${func}(...)`)
        break
      }
      if (client[func] === undefined) {
        const keys = _.keys(client);
        const kstr = keys.join(', ');
        // TODO control whether non-existent client funcs trigger warning/error
        commLink.log.verbose(`Undefined Func ${commLink.name}.${func}(...); keys are ${kstr}`);
        break
      }
      const maybeCallback = client[func];
      if (typeof maybeCallback === 'function') {
        commLink.log.verbose(`Calling ${commLink.name}.${func}(...)`)
        const cb = _.bind(maybeCallback, client);
        const newA = await Promise.resolve(cb(arg, commLink));
        const yieldMsg = cyield(func, newA, from);
        // prettyPrint({ hdr: 'call()', ret: newA, yieldMsg })
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
      const returnMsg = Message.address(creturn(func, currMsg.result), { id, from: commLink.name, to: callFrom });
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

export function newCommLink<ClientT>(name: string, maybeClient?: ClientT): CommLink<ClientT> {
  // const commClient = client !== undefined? client : {};
  const commLink: CommLink<ClientT> = {
    name,
    client: maybeClient,
    subscriber: newRedisClient(name),
    isShutdown: false,
    log: getServiceLogger(`${name}/comm`),
    messageHandlers: [],

    async call<A, B>(f: string, a: A, toHdr?: ToHeader): Promise<B> {
      const id = nextId();
      const to = toHdr !== undefined ? toHdr.to : name;
      // call remote function
      const callMessage = Message.address(call(f, a), { to, id });
      const expectedReturn = mergeMessages(creturn(f), { id });
      const returnP = new Promise<B>((resolve, reject) => {
        // TODO make .on() => .once()
        this.on(expectedReturn, (msg: Message) => {
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

    async send(msg: Message): Promise<void> {
      const addr = Message.address(
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

    async connect(client?: ClientT): Promise<void> {
      const self = this;

      self.client = client;

      return new Promise((resolve, reject) => {
        self.subscriber.on('message', (channel: string, packedMsg: string) => {
          self.log.verbose(`${name} received> ${packedMsg} on ${channel}`);
          const message = Message.unpack(packedMsg);
          runMessageHandlers<ClientT>(message, packedMsg, commLink, self.client);
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
