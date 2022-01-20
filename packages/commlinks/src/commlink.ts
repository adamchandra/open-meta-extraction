import _ from 'lodash';
import Redis from 'ioredis';
import winston from 'winston';
import { getServiceLogger, newIdGenerator, prettyFormat, prettyPrint } from '@watr/commonlib';

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
  MessageMod
} from './message-types';

import { newRedisClient } from './ioredis-conn';

const nextId = newIdGenerator(1);

async function runMessageHandlers<ClientT>(
  message: Message,
  packedMsg: string,
  commLink: CommLink<ClientT>,
  client: ClientT
): Promise<void> {
  // const { messageHandlers, log, send, name } = commLink;

  commLink.log.silly(`finding message handlers for ${packedMsg}`);
  const matchedHandlers = _.filter(commLink.messageHandlers, ([handlerKind,]) => {
    const matches = matchMessageToQuery(handlerKind, message);
    const hpf = prettyFormat(handlerKind);
    commLink.log.silly(`testing msg ~= ${hpf}? (match=${matches})`);
    return matches;
  });

  switch (message.kind) {
    case 'call': {
      const { func, arg, id } = message;
      const maybeCallback = client[func];
      if (typeof maybeCallback === 'function') {
        commLink.log.debug(`Calling ${func}(${arg})`)
        // const cb: CustomHandler<ClientT> = _.bind(maybeCallback, client);
        const cb = _.bind(maybeCallback, client);
        const newA = await Promise.resolve(cb(arg));
        const yieldVal: object = typeof newA === 'object' ? newA : {};
        const yieldMsg = cyield(func, yieldVal);
        await commLink.send(Message.address(yieldMsg, { id, to: commLink.name }));
      }
      break;
    }
    case 'cyield': {
      const { func, value, id, from } = message;
      const mods: MessageMod[] = _.map(matchedHandlers, ([handlerKind, handler]) => {
        const hk = prettyFormat(handlerKind);
        commLink.log.silly(`running handler ${hk} for ${packedMsg}`);
        const bh = _.bind(handler, client);
        const mod = bh(message);
        return mod;
      });
      const mk = prettyFormat(mods);
      commLink.log.silly(`handler mods: ${mk}`);
      const defaultMessage = Message.address(creturn(func, value), { id, from: commLink.name, to: from });
      _.merge(defaultMessage, message, ...mods);

      await commLink.send(defaultMessage);
    }
    default: {
      break;
    }
  }
}

export interface CommLink<ClientT> {
  name: string;
  client: ClientT;
  log: winston.Logger;

  // Handle a builtin message
  on(m: MessageQuery, h: MessageHandler<ClientT>): void;
  send(message: Message): Promise<void>;
  // Invoke a client installed function, either locally or on another node over the wire
  call<A extends object>(f: string, a: A, to?: ToHeader): Promise<A>;
  connect(): Promise<void>;
  quit(): Promise<void>;

  // Internal use:
  subscriber: Redis.Redis;
  messageHandlers: MessageHandlerDef<ClientT>[];
  isShutdown: boolean;
}

export function newCommLink<ClientT>(name: string, client: ClientT): CommLink<ClientT> {
  const commLink: CommLink<ClientT> = {
    name,
    client,
    subscriber: newRedisClient(name),
    isShutdown: false,
    log: getServiceLogger(`${name}/comm`),
    messageHandlers: [],

    async call<A extends object>(f: string, a: A, toHdr?: ToHeader): Promise<A> {
      const id = nextId();
      const to = toHdr !== undefined ? toHdr.to : name;
      // call remote function
      const callMessage = Message.address(call(f, a), { to, id });
      const expectedReturn = Message.address(creturn(f), { id });
      const returnP = new Promise<A>((resolve, reject) => {
        this.on(expectedReturn, (msg: Message) => {
          if (msg.kind !== 'creturn') {
            reject(new Error('unexpected message type'));
            return;
          }
          this.log(`got response ${msg}`)
          const avalue: A = msg.value as A;
          resolve(avalue);
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

    on(m: MessageQuery, h: MessageHandler<ClientT>): void {
      this.messageHandlers.push([m, h]);
    },

    async connect(): Promise<void> {
      const { subscriber, log, client } = this;

      return new Promise((resolve, reject) => {
        subscriber.on('message', (channel: string, packedMsg: string) => {
          log.verbose(`${name} received> ${packedMsg}`);

          const message = Message.unpack(packedMsg);

          runMessageHandlers<ClientT>(message, packedMsg, commLink, client);
          // const handlersForMessage = getMessageHandlers<ClientT>(message, packedMsg, commLink, client);

          // Async.mapSeries(handlersForMessage, async (handler: Thunk) => handler())
          //   .catch((error) => {
          //     log.warn(`> ${packedMsg} on ${channel}: ${error}`);
          //   });
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

  commLink.on(ping, async (msg: Message) => {
    const reply = addHeaders(ack(msg), { from: msg.to, to: msg.from, id: msg.id });
    await commLink.send(reply);
  });

  commLink.on(call(), async (msg: Message) => {
    if (msg.kind !== 'call') return;
    const response = await commLink.call(msg.func, msg.arg);
    prettyPrint({ response });
    // return response;
  });
  commLink.on(quit, async (msg: Message) => {
    const reply = addHeaders(ack(msg), { from: msg.to, to: msg.from, id: msg.id });
    await commLink.send(reply);
    await commLink.quit();
  });


  return commLink;
}


// export interface CommLink<ClientT> {
//   name: string;
//   log: winston.Logger;

//   on(m: MessageQuery, h: MessageHandler<ClientT>): void;
//   send(message: Message): Promise<void>;
//   call<A extends object>(f: string, a: A): Promise<A>;
//   callAndAwait<A>(a: A, m: MessageQuery, h: MessageHandler<ClientT>): Promise<A>;
//   connect(clientT: ClientT): Promise<void>;
//   quit(): Promise<void>;

//   // Internal use:
//   subscriber: Redis.Redis;
//   messageHandlers: MessageHandlerDef<ClientT>[];
//   isShutdown: boolean;
// }


// export function newCommLink<ClientT>(name: string): CommLink<ClientT> {
//   const commLink: CommLink<ClientT> = {
//     name,
//     subscriber: newRedisClient(name),
//     isShutdown: false,
//     log: getServiceLogger(`${name}/comm`),
//     messageHandlers: [],

//     async call<A extends object>(f: string, a: A): Promise<A> {
//       const id = nextId();
//       // TODO call function f on clientT
//       const replyBody: Reply = reply(f, a);
//       const toReply = Message.address(replyBody, { id, from: name, to: name });

//       return this.send(toReply);
//     },

//     async callAndAwait<A>(a: A, m: MessageQuery, h: MessageHandler<ClientT>): Promise<A> {
//       const responseP = this.on(m, h);
//       const yieldP = this.call(a);
//       // const responseP = new Promise<A>((resolve) => {
//       //   self.addHandler(
//       //     `${yieldId}:.*:${this.name}>yielded`,
//       //     async (msg: Message) => {
//       //       if (msg.kind !== 'yielded') return;
//       //       resolve(msg.value);
//       //     });
//       // });

//       return yieldP.then(() => responseP);
//     },

//     async send(msg: Message): Promise<void> {
//       const addr = Message.address(
//         msg, { from: name }
//       );
//       const packedMsg = Message.pack(addr);

//       if (this.isShutdown) {
//         this.log.warn(`${name}> shutdown; not sending message ${packedMsg}`);
//         return;
//       }
//       const { to } = msg;

//       const publisher = this.subscriber.duplicate();
//       await publisher.publish(to, packedMsg);
//       this.log.verbose(`publishing ${packedMsg}`);
//       await publisher.quit();
//     },

//     on(m: MessageQuery, h: MessageHandler<ClientT>): void {
//       this.messageHandlers.push([m, h]);
//     },

//     async connect(clientT: ClientT): Promise<void> {
//       const { subscriber, log } = this;

//       return new Promise((resolve, reject) => {
//         subscriber.on('message', (channel: string, packedMsg: string) => {
//           log.verbose(`${name} received> ${packedMsg}`);

//           const message = Message.unpack(packedMsg);

//           const handlersForMessage = getMessageHandlers<ClientT>(message, packedMsg, commLink, clientT);

//           Async.mapSeries(handlersForMessage, async (handler: Thunk) => handler())
//             .catch((error) => {
//               log.warn(`> ${packedMsg} on ${channel}: ${error}`);
//             });
//         });

//         subscriber.subscribe(`${name}`)
//           .then(() => log.info(`${name}> connected`))
//           .then(() => resolve())
//           .catch((error: any) => {
//             const msg = `subscribe> ${error}`;
//             reject(new Error(msg));
//           });
//       });
//     },
//     async quit(): Promise<void> {
//       const self = this;
//       return new Promise((resolve) => {
//         self.subscriber.on('end', () => resolve());
//         self.isShutdown = true;
//         self.subscriber.quit();
//       });
//     }
//   };

//   commLink.on(ping, async (msg: Message) => {
//     const reply = addHeaders(ack(msg), { from: msg.to, to: msg.from, id: msg.id });
//     await commLink.send(reply);
//   });
//   // commLink.on(CallKind('push'), async (msg: Message) => {
//   //   if (msg.kind !== 'push') return;
//   //   return this.sendHub(msg.msg);
//   // });
//   commLink.on(quit, async (msg: Message) => {
//     const reply = addHeaders(ack(msg), { from: msg.to, to: msg.from, id: msg.id });
//     await commLink.send(reply);
//     await commLink.quit();
//   });


//   return commLink;
// }

    // addCustom(dispatches: CustomHandlers<ClientT>): void {
    //   // commLink.addHandler(`dispatch/${functionName}`, async function(msg) {
    //   //   if (msg.kind !== 'dispatch') return;
    //   //   const { func, arg } = msg;
    //   //   const f = commLink.dispatchHandlers[func];
    //   //   if (f !== undefined) {
    //   //     const bf = _.bind(f, this);
    //   //     const result = await bf(arg);
    //   //     const yld = result === undefined ? null : result;

    //   //     await commLink.send(
    //   //       Address(
    //   //         Yield(yld), { id: msg.id, to: currService }
    //   //       )
    //   //     );
    //   //   }
    //   // });
    //   const all = {
    //     ...this.dispatchHandlers,
    //     ...dispatches,
    //   };
    //   this.dispatchHandlers = all;
    // },

// function getMessageHandlers<ClientT>(
//   message: Message,
//   packedMsg: string,
//   commLink: CommLink<ClientT>,
//   clientT: ClientT
// ): Thunk[] {
//   const { messageHandlers } = commLink;

//   commLink.log.silly(`finding message handlers for ${packedMsg}`);
//   const matchedHandlers = _.filter(messageHandlers, ([handlerKind,]) => {
//     const matches = matchMessageToQuery(handlerKind, message);
//     const hpf = prettyFormat(handlerKind);
//     commLink.log.silly(`testing msg ~= ${hpf}? (match=${matches})`);

//     return matches;
//   });

//   const handlers = _.map(matchedHandlers, ([handlerKind, handler]) => {
//     const hk = prettyFormat(handlerKind);
//     commLink.log.silly(`found message handler ${hk} for ${packedMsg}`);
//     const bh = _.bind(handler, clientT);
//     return () => bh(message);
//   });

//   return handlers;
// }
