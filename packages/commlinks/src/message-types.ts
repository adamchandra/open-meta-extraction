import _ from 'lodash';

export type Thunk = () => Promise<void>;

export type MessageHandler<ClientT> = (this: ClientT, msg: Message) => Promise<Message | void>;
export type MessageHandlerDef<ClientT> = [MessageQuery, MessageHandler<ClientT>];
export type DispatchHandler<ClientT, A = any, B = any> = (this: ClientT, a: A) => Promise<B>;
export type DispatchHandlers<ClientT> = Record<string, DispatchHandler<ClientT>>;

// Base Message Body, kind=ping/ack/quit/etc..
//   Qualified Message Body, qual (qualified kind) allows matching on messages
//   like call/userFunc, ack/ping, etc., where full qualifed message kind
//   is 'kind/qual'

//////////
//
export interface Call {
  kind: 'call';
  func: string;
  arg: object;
}
export function call<
  S extends string | undefined,
  V extends object | undefined>(
  func?: S,
  arg?: V,
): S extends string ? (V extends object ? Call : Partial<Call>) : Partial<Call> {
  return {
    kind: 'call',
    func,
    arg
  };
}

// export interface CallKind {
//   kind: 'call';
//   qual: string;
// }
// export function CallKind(func: string): CallKind {
//   return { kind: 'call', qual: func };
// }

// export interface Call extends CallKind {
//   arg: any;
// }

// export function Call(func: string, arg: any): Call {
//   return { ...CallKind(func), arg };
// }

export interface Reply {
  kind: 'reply';
  call: string;
  value: object;
}
export function reply<
  S extends string | undefined,
  V extends object | undefined>(
  subkind?: S,
  value?: V,
): S extends string ? (V extends undefined ? Partial<Reply> : Reply) : Partial<Reply> {
  return {
    kind: 'reply',
    call: subkind,
    value
  };
}


/////////
// Builtin to commLink

export interface Pong {
  kind: 'pong';
  subk: string;
}
export function pong<S extends string | undefined>(
  subkind: S
): S extends string ? Pong : Partial<Pong> {
  return {
    kind: 'pong',
    subk: subkind
  };
}


// Ping
export interface Ping {
  kind: 'ping';
}
export const ping: Ping = { kind: 'ping' };


// Ack
export interface Ack {
  kind: 'ack';
  subk: string;
}
export function ack<S extends Body | undefined>(
  subkind: S
): S extends Body ? Ack : Partial<Ack> {
  return {
    kind: 'ack',
    subk: subkind.kind
  };
}


// Quit
export interface Quit {
  kind: 'quit';
}
export const quit: Quit = { kind: 'quit' };

export type Body =
  Call
  | Reply
  | Ping
  | Quit
  | Ack
  ;

interface Headers {
  from: string;
  to: string;
  id: number;
}

// export type MessageKind = BodyKind & Partial<Headers>;
export type Message = Body & Headers;

export const Message = {
  pack: packMessage,
  unpack: unpackMessage,
  address(body: Message | Body, headers: Partial<Headers>): Message {
    if ('from' in body && 'to' in body) {
      return _.merge({}, body, headers);
    }
    const defaultHeaders: Headers = {
      from: '', to: '', id: 0
    };
    return _.merge({}, body, defaultHeaders, headers);
  }
};

export type MessageQuery = Partial<Message>;

export const AnyKind: MessageQuery = {};

export function addHeaders<T extends Body | MessageQuery | Message, H extends Headers | Partial<Headers>>(
  input: T,
  h: H
): T extends Message ? Message : H extends Headers ? Message : MessageQuery {
  const output: T = _.merge({}, input, h);

  return <T>output as any;
}
export function updateHeaders(message: Message, headers: Partial<Headers>): Message {
  return _.assign(message, headers);
}


// export function unpackHeaders(headers: string): Headers {
//   const [ids, to, from] = headers.split(/:/);
//   const id = Number.parseInt(ids, 10);
//   return { id, to, from };
// }
// export function packHeaders(message: Message): string {
//   const { from, to, id } = message;
//   const hdrs = `${id}:${to}:${from}>`;
//   return hdrs;
// }

export function packMessage(message: Message): string {
  return JSON.stringify(message);
}

export function unpackMessage(packed: string): Message {
  return JSON.parse(packed);
}

function undefOrEqual<A>(a1: any, a2: A, prop: string): boolean {
  const propInA = prop in a1;
  const propInB = prop in a2;

  return !propInA || (
    (propInA && propInB)
    && a1[prop] === a2[prop]
  );
}

export function matchMessageToQuery(
  query: MessageQuery,
  messageKind: Message
): boolean {
  return undefOrEqual(query, messageKind, 'kind')
    && undefOrEqual(query, messageKind, 'qual')
    && undefOrEqual(query, messageKind, 'from')
    && undefOrEqual(query, messageKind, 'to')
    && undefOrEqual(query, messageKind, 'id')
}
