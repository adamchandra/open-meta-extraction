import 'chai/register-should';
import _ from 'lodash';

import { consoleTransport, newLogger } from '@watr/commonlib';
import * as TE from 'fp-ts/TaskEither';
import { isRight } from 'fp-ts/Either';
import Async from 'async';
import { flow as compose } from 'fp-ts/function';
import { Logger } from 'winston';
import * as ft from './function-defs';


interface EnvT {
  ns: [];
  b: boolean;
  enterNS(ns: string[]): void;
  exitNS(ns: string[]): void;
  log: Logger;
  messages: string[];
}

const fp = ft.createFPackage<EnvT>();

type ExtractionResult<A> = ft.ExtractionResult<A, EnvT>;
type Arrow<A, B> = ft.Arrow<A, B, EnvT>;
type PerhapsW<A> = ft.PerhapsW<A, EnvT>;
// type FilterArrow<A> = ft.FilterArrow<A, EnvT>;

const {
  tap,
  tapLeft,
  filter,
  Arrow,
  through,
  // ExtractionResult,
  asW,
  forEachDo,
  takeFirstSuccess,
  takeWhileSuccess,
  gatherSuccess,
} = fp;


// const compose: typeof fpflow = (...fs: []) => <A extends readonly unknown[]>(a: A) => pipe(a, ...fs);

const withMessage: <A, B>(name: string, arrow: Arrow<A, B>) => Arrow<A, B> = (name, arrow) => compose(
  // ra,
  tap((_a, env) => env.messages.push(`${name}:enter:right`)),
  tapLeft((_a, env) => env.messages.push(`${name}:enter:left`)),
  arrow,
  tap((_a, env) => env.messages.push(`${name}:exit:right`)),
  tapLeft((_a, env) => env.messages.push(`${name}:exit:left`)),
);


// const fgood: (s: string) => Arrow<string, string> = s => withMessage(`succ:${s}`, filter<string>(() => true));
const fbad: (s: string) => Arrow<string, string> = s => withMessage(`fail:${s}`, filter<string>(() => false));
const fgood_: Arrow<string, string> = withMessage('succ', filter<string>(() => true));
const fbad_: Arrow<string, string> = withMessage('fail', filter<string>(() => false));
const emit = (msg: string) => tap<string>((_a, env) => env.messages.push(msg));
const emitL = (msg: string) => tapLeft<string>((_a, env) => env.messages.push(msg));


function initEnv<A>(a: A): ExtractionResult<A> {
  const logger = newLogger(consoleTransport('info'));
  const env0: EnvT = {
    ns: [],
    b: true,
    enterNS(_ns: string[]) { /* */ },
    exitNS(_ns: string[]) { /* */ },
    log: logger,
    messages: []
  };

  // return TE.right(asW(`input#${dummy += 1}`, env0));
  return TE.right(asW(a, env0));
}


function getEnvMessages(res: PerhapsW<unknown>): string[] {
  if (isRight(res)) {
    const [, env] = res.right;
    return env.messages;
  }
  const [, env] = res.left;
  return env.messages;
}

let dummy = 0;
async function runTakeWhileSuccess(fns: Arrow<string, string>[]): Promise<string[]> {
  const res = await takeWhileSuccess(...fns)(initEnv(`input#${dummy += 1}`))();
  return getEnvMessages(res);
}


async function runTakeFirstSuccess(fns: Arrow<string, string>[]): Promise<string[]> {
  const res = await takeFirstSuccess(...fns)(initEnv(`input#${dummy += 1}`))();
  return getEnvMessages(res);
}

async function runGatherSuccess(fns: Arrow<string, string>[]): Promise<string[]> {
  const res = await gatherSuccess(...fns)(initEnv(`input#${dummy += 1}`))();
  return getEnvMessages(res);
}

// async function runForEachDo(fn: Arrow<number, string>): Promise<string[]> {
//   const inputs = _.range(4);
//   const env0 = initEnv(inputs);
//   const res = await forEachDo(fn)(env0)();
//   return getEnvMessages(res);
// }

describe('Extraction Prelude / Primitives', () => {
  // it('should create basic arrows/results', async (done) => {});
  // it('tap() composition', async (done) => { });

  it('takeWhileSuccess examples', async () => {
    const examples: Array<[Arrow<string, string>[], string[]]> = [
      [[emit('A:okay'), fbad_, emit('B:bad')],
        ['A:okay']],
      [[emit('A:okay'), emit('B:okay'), fbad_, emit('B:bad')],
        ['A:okay', 'B:okay']],
      [[emit('A:okay'), fgood_, emit('B:okay'), fbad_, emitL('CL:okay')],
        ['A:okay', 'B:okay', 'CL:okay']],
      [[fbad_, emit('B:bad')],
        []],
    ];


    await Async.eachOf(examples, Async.asyncify(async ([example, expectedMessages]) => {
      // console.log('p.1')
      const messages = await runTakeWhileSuccess(example);
      // console.log('p.2')

      const haveExpectedMessages = _.every(expectedMessages, em => messages.includes(em));
      // console.log('p.3')
      const haveBadMessages = _.some(messages, msg => /bad/.test(msg));

      // prettyPrint({ msg: `example: ${n}`, messages, expectedMessages });

      expect(haveExpectedMessages).toBe(true);
      expect(haveBadMessages).toBe(false);
      // console.log('p.5')
    }));


    // console.log('p.10')
    // done();
  });

  it('takeFirstSuccess examples', async () => {
    const examples: Array<[Arrow<string, string>[], string[]]> = [
      // Always stop at first emit:
      [[emit('A:okay'), emit('B:bad')],
        ['A:okay']],
      [[emit('A:okay'), fgood_, emit('B:bad')],
        ['A:okay']],
      [[emit('A:okay'), fbad_, emit('B:bad')],
        ['A:okay']],

      // Skip any initial failures
      [[fbad('1'), emit('A:okay'), emit('B:bad')],
        ['A:okay']],

      [[fbad('2'), fbad('3'), emit('A:okay'), emit('B:bad')],
        ['A:okay']],

      [[fbad_, fgood_, emit('A:okay'), emit('B:bad')],
        []],

    ];


    await Async.eachOf(examples, Async.asyncify(async ([example, expectedMessages], _n) => {
      const messages = await runTakeFirstSuccess(example);
      const haveExpectedMessages = _.every(expectedMessages, em => messages.includes(em));
      const haveBadMessages = _.some(messages, msg => /bad/.test(msg));

      // prettyPrint({ msg: `example: ${n}`, messages, expectedMessages });

      expect(haveExpectedMessages).toBe(true);
      expect(haveBadMessages).toBe(false);
    }));


    // done();
  });

  it('gatherSuccess examples', async () => {
    const examples: Array<[Arrow<string, string>[], string[]]> = [
      [[emit('A:okay'), emit('B:okay')],
        ['A:okay', 'B:okay']],
      [[emit('A:okay'), fgood_, emit('B:okay')],
        ['A:okay', 'B:okay']],
      [[emit('A:okay'), fbad_, emit('B:okay')],
        ['A:okay', 'B:okay']],
      [[fbad_, fgood_, emit('A:okay'), fbad_, emit('B:okay'), fbad_],
        ['A:okay', 'B:okay']],
    ];


    await Async.eachOf(examples, Async.asyncify(async ([example, expectedMessages], _n) => {
      console.log('p.1');
      const messages = await runGatherSuccess(example);
      console.log('p.2');
      const haveExpectedMessages = _.every(expectedMessages, em => messages.includes(em));
      const haveBadMessages = _.some(messages, msg => /bad/.test(msg));

      // prettyPrint({ msg: `example: ${_n}`, messages, expectedMessages });

      expect(haveExpectedMessages).toBe(true);
      expect(haveBadMessages).toBe(false);
      console.log('p.3');
    }));

    console.log('p.5');

    // done();
  });

  it('forEachDo examples', async () => {
    // Expected results for n=[1..4]
    const expected: Array<string[]> = [
      // if n % 1 === 0 output 'n:okay'
      ['1:okay', '2:okay', '3:okay', '4:okay'],
      // if n % 2 === 0 output 'n:okay'
      ['2:okay', '4:okay'],
      ['3:okay'],
      ['4:okay'],
    ];


    const modOkay = (mod: number) => compose(
      filter<number>((n) => n % mod === 0),
      through((n) => `${n}:okay`)
    );


    await Async.eachOf(expected, Async.asyncify(async (exp, _n) => {
      if (typeof _n !== 'number') {
        fail('_n != "number"');
      }
      const n = _n + 1;
      const inputs = _.map(_.range(4), i => i + 1);
      const env0 = initEnv(inputs);
      const res = await forEachDo(modOkay(n))(env0)();
      if (isRight(res)) {
        const [a] = res.right;
        // prettyPrint({ msg: `example: ${n}`, a });
        expect(a).toStrictEqual(exp);
      } else {
        fail('!right(res');
      }
    }));

    // done();
  });
});
