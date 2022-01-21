import _ from 'lodash';

export type Thunk = () => Promise<void>;

export type MessageHandler<ClientT, M extends Message> = (this: ClientT, msg: M) => Promise<M | void>;
// export type MessageHandler<ClientT> = (this: ClientT, msg: Message) => Promise<MessageMod | void>; // TODO remove void

export type MessageHandlerDef<ClientT> = [MessageQuery, MessageHandler<ClientT, Message>];

export type CustomHandler<ClientT, A = object, B = any> = (this: ClientT, a: A) => Promise<B>;
export type CustomHandlers<ClientT> = Record<string, CustomHandler<ClientT>>;

// Helper type : TODO document
type IfStrObjStr<S, T, U, A, B> = S extends string ? T extends object ? U extends string ? A : B : B : B;

function filterUndefs<T>(o: T): T {
  const newO = _.clone(o);
  _.each(_.keys(o), k => {
    if (newO[k] === undefined) {
      delete newO[k];
    }
  });
  return newO;
}
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
  return filterUndefs({
    kind: 'call',
    func,
    arg
  });
}

export interface CYield {
  kind: 'cyield';
  func: string;
  value: object;
  callFrom: string;
}


export function cyield<
  S extends string | undefined,
  T extends object | undefined,
  U extends string | undefined>(
    func?: S,
    value?: T,
    callFrom?: U,
): IfStrObjStr<S, T, U, CYield, Partial<CYield>> {
  return filterUndefs({
    kind: 'cyield',
    func,
    value,
    callFrom
  });
}

export interface CReturn {
  kind: 'creturn';
  func: string;
  value: object;
}
export function creturn<
  S extends string | undefined,
  V extends object | undefined>(
    func?: S,
    value?: V,
): S extends string ? (V extends undefined ? Partial<CReturn> : CReturn) : Partial<CReturn> {
  return filterUndefs({
    kind: 'creturn',
    func,
    value
  });
}

/////////
// Builtin to commLink

export interface Ping {
  kind: 'ping';
}
export const ping: Ping = { kind: 'ping' };

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

export interface Quit {
  kind: 'quit';
}
export const quit: Quit = { kind: 'quit' };

export type Body =
  Ping
  | Ack
  | Quit
  | Call
  | CReturn
  | CYield
  ;

type BodyKind = Body['kind'];

interface Headers {
  from: string;
  to: string;
  id: number;
}

export type ToHeader = Pick<Headers, 'to'>;

export function fromHeader(s: string): Pick<Headers, 'from'> {
  return { from: s };
}

export function toHeader(s: string): Pick<Headers, 'to'> {
  return { to: s };
}

export function idHeader(id: number): Pick<Headers, 'id'> {
  return { id };
}


export function queryAll(...mqs: MessageQuery[]): MessageQuery {
  return _.merge({}, ...mqs)
}

export type Message = Body & Headers;

export function mergeMessages(...mqs: MessageQuery[]): MessageQuery {
  return _.merge({}, ...mqs)
}

export const Message = {
  pack: packMessage,
  unpack: unpackMessage,
  address(body: Message | Body, headers: Partial<Headers>): Message {
    // return _.merge({}, body, headers);
    // return mergeMessages(body, headers)
    // if ('from' in body && 'to' in body) {
    //   return _.merge({}, body, headers);
    // }
    const defaultHeaders: Headers = {
      from: undefined, to: undefined, id: undefined
    };
    return _.merge({}, body, defaultHeaders, headers);
  }
};

export type MessageQuery = Partial<Message>;
export type MessageMod = Partial<Message>;

export const AnyMessage: MessageQuery = {};

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

export function packMessage(message: Message): string {
  return JSON.stringify(message);
}

export function unpackMessage(packed: string): Message {
  return JSON.parse(packed);
}

function matchQueryProp<A>(a1: any, a2: A, prop: string): boolean {
  const propInA = prop in a1;
  const propInB = prop in a2;

  return !propInA
    || a1[prop] === undefined
    || (propInA && propInB)
    && a1[prop] === a2[prop]
    ;
}

export function matchMessageToQuery(
  query: MessageQuery,
  messageKind: Message
): boolean {
  const queryKeys = _.keys(query);
  return _.every(queryKeys, (k) => matchQueryProp(query, messageKind, k));
}
