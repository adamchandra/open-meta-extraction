import _ from 'lodash';
import { putStrLn, parseJson } from '@watr/commonlib';

export type Thunk = () => Promise<void>;

export type MessageHandler<This> = (this: This, msg: Message) => Promise<Message | void>;
export type MessageHandlerDef<This> = [string, MessageHandler<This>];
export type MessageHandlerRec<This> = Record<string, MessageHandler<This>>;
export type MessageHandlers<This> = MessageHandlerDef<This>[];

export type DispatchHandler<This, A = any, B = any> = (this: This, a: A) => Promise<B>;
// export type DispatchHandlerDef<This> = [string, MessageHandler<This>];
// export type DispatchHandlers<This> = Record<string, DispatchHandler<This>>;
export type DispatchHandlers<This> = Record<string, DispatchHandler<This>>;

export interface Dispatch {
  kind: 'dispatch';
  func: string;
  arg: any;
}


export const Dispatch = (func: string, arg: any) =>
  <Dispatch>{
    kind: 'dispatch',
    func, arg
  };

export interface Yielded {
  kind: 'yielded';
  value: any;
}

export const Yielded = (value: any) =>
  <Yielded>{
    kind: 'yielded', value
  };

export interface Yield {
  kind: 'yield';
  value: any;
}

export const Yield = (value: any) =>
  <Yield>{
    kind: 'yield', value
  };

export interface Push {
  kind: 'push';
  msg: MessageBody;
}

export const Push = (msg: MessageBody) =>
  <Push>{
    kind: 'push', msg
  };

export interface Ack {
  kind: 'ack';
  acked: string;
}

export const Ack = (msg: MessageBody) =>
  <Ack>{
    kind: 'ack', acked: msg.kind
  };

export type Ping = { kind: 'ping' };
export const Ping: Ping = { kind: 'ping' };

export type Quit = { kind: 'quit' };
export const Quit: Quit = { kind: 'quit' };


export type MessageBody =
  Yield
  | Yielded
  | Dispatch
  | Push
  | Ping
  | Quit
  | Ack
  ;

export interface AddrTo {
  to: string;
}

export interface AddrFrom {
  from: string;
}

export type Address = AddrFrom & AddrTo;
export const Address = (body: Message | MessageBody, headers: Partial<Headers>) => {
  if ('from' in body && 'to' in body) {
    return _.merge({}, body, headers);
  }
  const defaultHeaders: Headers = {
    from: '', to: '', id: 0
  };
  return _.merge({}, body, defaultHeaders, headers);
}

export interface Headers extends Address {
  id: number;
}

export type Message = MessageBody & Headers;

export const Message = {
  pack: packMessage,
  unpack: unpackMessage,
  address(body: Message | MessageBody, headers: Partial<Headers>): Message {
    if ('from' in body && 'to' in body) {
      return _.merge({}, body, headers);
    }
    const defaultHeaders: Headers = {
      from: '', to: '', id: 0
    };
    return _.merge({}, body, defaultHeaders, headers);
  }
}

export function packMessageBody(message: MessageBody): string {
  switch (message.kind) {
    case 'dispatch': {
      const { func, arg } = message;
      const varg = arg === undefined ? '"null"' : JSON.stringify(arg);
      return `dispatch/${func}:${varg}`;
    }
    case 'yield': {
      const { value } = message;
      const vstr = JSON.stringify(value);
      return `yield/${vstr}`;
    }
    case 'yielded': {
      const { value } = message;
      const vstr = JSON.stringify(value);
      return `yielded/${vstr}`;
    }
    case 'push': {
      const { msg } = message;
      const vstr = packMessageBody(msg);
      return `push/${vstr}`;
    }
    case 'ping': {
      return 'ping';
    }
    case 'ack': {
      const { acked } = message;
      return `ack/${acked}`;
    }
    case 'quit': {
      return 'quit';
    }
  }
}

export function unpackMessageBody(packedMessage: string): MessageBody {
  const slashIndex = packedMessage.indexOf('/')
  let msgKind = packedMessage;
  let body = '';

  if (slashIndex > 0) {
    msgKind = packedMessage.substr(0, slashIndex);
    body = packedMessage.substr(slashIndex + 1);
  }

  let unpackedMsg: MessageBody;

  switch (msgKind) {
    case 'dispatch': {
      const divider = body.indexOf(':')
      const func = body.substr(0, divider);
      const argstr = body.substr(divider + 1);
      const arg = parseJson(argstr);
      unpackedMsg = {
        kind: msgKind,
        func,
        arg
      };
      break;
    }
    case 'yield':
    case 'yielded': {
      unpackedMsg = {
        kind: msgKind,
        value: parseJson(body)
      };
      break;
    }
    case 'push': {
      unpackedMsg = {
        kind: msgKind,
        msg: unpackMessageBody(body)
      };
      break;
    }

    case 'ack': {
      unpackedMsg = {
        kind: msgKind,
        acked: body
      };
      break;
    }
    case 'ping':
    case 'quit':
      unpackedMsg = {
        kind: msgKind,
      };
      break;
    default:
      putStrLn(`Default:Could not unpack Message ${packedMessage}`);
      throw new Error(`Could not unpack Message payload ${packedMessage}`)
  }

  return unpackedMsg;
}

export function updateHeaders(message: Message, headers: Partial<Headers>): Message {
  return _.assign(message, headers);
}


export function unpackHeaders(headers: string): Headers {
  const [ids, to, from] = headers.split(/:/)
  const id = parseInt(ids, 10);
  return { id, to, from };
}
export function packHeaders(message: Message): string {
  const { from, to, id } = message;
  const hdrs = `${id}:${to}:${from}>`;
  return hdrs;
}

export function packMessage(message: Message): string {
  const hdrs = packHeaders(message);
  const pmsg = packMessageBody(message);
  return `${hdrs}${pmsg}`;
}


export function unpackMessage(packed: string): Message & Address {
  const divider = packed.indexOf('>')
  const hdrs = packed.substr(0, divider).trim();
  const message = packed.substr(divider + 1).trim();

  const headers: Headers = unpackHeaders(hdrs);
  const body: MessageBody = unpackMessageBody(message);

  return ({
    ...headers,
    ...body
  });
}
