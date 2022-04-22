import _ from 'lodash';

import { pipe } from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import * as Task from 'fp-ts/Task';
import * as E from 'fp-ts/Either';
import { isLeft } from 'fp-ts/Either';
import { Logger } from 'winston';
import Async from 'async';
import { prettyFormat } from '@watr/commonlib';

export interface FPackage<Env extends BaseEnv> {
  asW<A>(a: A, w: Env): W<A, Env>;
  asWCI(ci: ControlInstruction, w: Env): WCI<Env>;

  withNS: <A, B>(name: string, arrow: Arrow<A, B, Env>) => Arrow<A, B, Env>;
  withCarriedWA: <A, Env extends BaseEnv>(arrow: Arrow<A, unknown, Env>) => Arrow<A, A, Env>;
  through<A, B>(f: ClientFunc<A, B, Env>, name: string, postHook?: PostHook<A, B, Env>,): Arrow<A, B, Env>;
  throughLeft<A>(f: ControlFunc<Env>): Arrow<A, A, Env>;
  tapLeft<A>(f: ControlFunc_<Env>): Arrow<A, A, Env>
  tap<A>(f: ClientFunc<A, unknown, Env>, name?: string): Arrow<A, A, Env>;
  filter<A>(f: ClientFunc<A, boolean, Env>, name?: string, postHook?: PostHook<A, boolean, Env>,): FilterArrow<A, Env>;

  forEachDo: <A, B> (arrow: Arrow<A, B, Env>) => Arrow<A[], B[], Env>;

  // map(fs: (A=>B)[], a: A) => Either<E, B>[], then filter(isRight(bs))
  gatherSuccess: <A, B> (...arrows: Arrow<A, B, Env>[]) => Arrow<A, B[], Env>;
  takeWhileSuccess: <A, Env extends BaseEnv> (...arrows: Arrow<A, A, Env>[]) => Arrow<A, A, Env>;
  eachOrElse: <A, B> (...arrows: Arrow<A, B, Env>[]) => Arrow<A, B, Env>;


  log: <A>(level: LogLevel, f: (a: A, env: Env) => string) => Arrow<A, A, Env>;

  Arrow: {
    lift: <A, B>(
      fab: ClientFunc<A, B, Env>,
      postHook?: (a: A, eb: Perhaps<B>, env: Env) => void,
    ) => Arrow<A, B, Env>;
  };


  ExtractionResult: {
    lift: <A>(a: Eventual<A>, env: Env) => ExtractionResult<A, Env>;
    liftW: <A>(wa: Eventual<W<A, Env>>) => ExtractionResult<A, Env>;
    liftFail: <A>(ci: Eventual<ControlInstruction>, env: Env) => ExtractionResult<A, Env>;
  };

  ClientFunc: {
    success: <A>(a: A) => Perhaps<A>;
    halt: <A>(msg: string) => Perhaps<A>;
    continue: <A>(msg: string) => Perhaps<A>;
  }
}

export function createFPackage<Env extends BaseEnv>(): FPackage<Env> {
  const fp: FPackage<Env> = {
    asW,
    asWCI,
    withNS,
    withCarriedWA,
    forEachDo,
    gatherSuccess,
    eachOrElse,
    takeWhileSuccess,
    through,
    throughLeft,
    tapLeft,
    tap,
    filter,
    log,
    Arrow,
    ExtractionResult,
    ClientFunc,
  };
  return fp;
}

function isELeft<A>(a: any): a is E.Left<A> {
  const isObj = typeof a === 'object';
  const isTagged = isObj && '_tag' in a;

  return isObj && isTagged && a._tag === 'Left' && 'left' in a;
}
function isERight<A>(a: any): a is E.Right<A> {
  const isObj = typeof a === 'object';
  const isTagged = isObj && '_tag' in a;
  return isObj && isTagged && a._tag === 'Right' && 'right' in a;
}

/**
 * Instructions returned on the the Left to signal control flow
 * e.g., hard stop on error, continue after failure
 */
export type ControlCode = 'halt' | 'continue';
export type ControlInstruction = ControlCode | [ControlCode, string];

export interface BaseEnv {
  ns: string[];
  enterNS(ns: string[]): void;
  exitNS(ns: string[]): void;
  log: Logger;
}


/**
 * Return value with user defined Environment
 */
export type W<A, Env extends BaseEnv> = [a:A, env:Env];
function asW<A, Env extends BaseEnv>(a: A, w: Env): W<A, Env> {
  return [a, w];
}

export type WCI<Env extends BaseEnv> = W<ControlInstruction, Env>;
function asWCI<Env extends BaseEnv>(ci: ControlInstruction, w: Env): WCI<Env> {
  return [ci, w];
}

/**
 * Type signatures for client functions and return types
 */

export type Eventual<A> = A | Promise<A>;

export type Perhaps<A> = E.Either<ControlInstruction, A>;
export type PerhapsW<A, Env extends BaseEnv> = E.Either<WCI<Env>, W<A, Env>>;

export type PostHook<A, B, Env extends BaseEnv> = (a: A, eb: Perhaps<B>, env: Env) => void;

export type ClientResult<A> = Eventual<A>
  | Eventual<Perhaps<A>>
  | TE.TaskEither<ControlInstruction, A>
  ;

export type ClientFunc<A, B, Env extends BaseEnv> = (a: A, env: Env) => ClientResult<B>;
export type ControlFunc<Env extends BaseEnv> =
  (ci: ControlInstruction, env: Env) => ControlInstruction;

export type ControlFunc_<Env extends BaseEnv> =
  (ci: ControlInstruction, env: Env) => unknown;

const ClientFunc = {
  success: <A>(a: A): Perhaps<A> => E.right(a),
  halt: <A>(msg: string): Perhaps<A> => E.left(['halt', msg]),
  continue: <A>(msg: string): Perhaps<A> => E.left(['continue', msg]),
};


/// ///////////
/// Lifted function types

export type EventualResult<A, Env extends BaseEnv> = Promise<PerhapsW<A, Env>>;
const EventualResult = {
  lift: <A, Env extends BaseEnv>(a: Eventual<A>, env: Env): EventualResult<A, Env> => Promise.resolve<A>(a).then(a0 => E.right(asW(a0, env))),

  liftW: <A, Env extends BaseEnv>(wa: Eventual<W<A, Env>>): EventualResult<A, Env> => Promise.resolve<W<A, Env>>(wa).then(wa0 => E.right(wa0)),

  liftFail: <A, Env extends BaseEnv>(ci: Eventual<ControlInstruction>, env: Env): EventualResult<A, Env> => Promise.resolve<ControlInstruction>(ci).then(ci0 => E.left(asW(ci0, env))),
};


export type ExtractionResult<A, Env extends BaseEnv> = TE.TaskEither<WCI<Env>, W<A, Env>>;
const ExtractionResult = {
  lift: <A, Env extends BaseEnv>(a: Eventual<A>, env: Env): ExtractionResult<A, Env> => () => Promise.resolve<A>(a).then(a0 => E.right(asW(a0, env))),

  liftW: <A, Env extends BaseEnv>(wa: Eventual<W<A, Env>>): ExtractionResult<A, Env> => () => Promise.resolve<W<A, Env>>(wa).then(wa0 => E.right(wa0)),

  liftFail: <A, Env extends BaseEnv>(ci: Eventual<ControlInstruction>, env: Env): ExtractionResult<A, Env> => () => Promise.resolve<ControlInstruction>(ci).then(ci0 => E.left(asW(ci0, env))),
};

export interface Arrow<A, B, Env extends BaseEnv> {
  (ra: ExtractionResult<A, Env>): ExtractionResult<B, Env>;
}

const Arrow = {
  lift: <A, B, Env extends BaseEnv>(
    fab: ClientFunc<A, B, Env>,
    postHook?: (a: A, eb: Perhaps<B>, env: Env) => void,
  ): Arrow<A, B, Env> => (er: ExtractionResult<A, Env>) => pipe(er, TE.fold(
    ([controlInstruction, env]) => {
      return ExtractionResult.liftFail(controlInstruction, env);
    },
    ([prev, env]) => {
      return () => Promise.resolve(fab(prev, env))
        .then(async (result) => {
          if (isELeft(result)) {
            const ci = result.left;
            if (postHook) {
              postHook(prev, result, env);
            }
            return EventualResult.liftFail<B, Env>(ci, env);
          }
          if (isERight(result)) {
            const b = result.right;
            if (postHook) {
              postHook(prev, result, env);
            }
            return EventualResult.lift<B, Env>(b, env);
          }
          if (_.isFunction(result)) {
            return result()
              .then(res => {
                if (postHook) {
                  postHook(prev, res, env);
                }
                if (E.isLeft(res)) {
                  return EventualResult.liftFail<B, Env>(res.left, env);
                }
                return EventualResult.lift<B, Env>(res.right, env);
              });
          }

          if (postHook) {
            postHook(prev, E.right(result), env);
          }
          return EventualResult.lift(result, env);
        })
        .catch((error) => {
          return EventualResult.liftFail<B, Env>(['halt', error.toString()], env);
        });
    }
  )),
};


export type FilterArrow<A, Env extends BaseEnv> = Arrow<A, A, Env>;
export type ExtractionFunction<A, B, Env extends BaseEnv> = (a: A, env: Env) => ExtractionResult<B, Env>;
export type FilterFunction<A, Env extends BaseEnv> = ExtractionFunction<A, A, Env>;
export type EnvFunction<B, Env extends BaseEnv> = ExtractionFunction<void, B, Env>;

const pushNS: <A, Env extends BaseEnv>(n: string) => Arrow<A, A, Env> = <A, Env extends BaseEnv>(name: string) => (ra: ExtractionResult<A, Env>) => {
  return pipe(
    ra,
    TE.map(([a, env]) => {
      env.ns.push(name);
      env.enterNS(env.ns);
      return asW(a, env);
    }),
    TE.mapLeft(([a, env]) => {
      env.ns.push(name);
      env.enterNS(env.ns);
      return asW(a, env);
    })
  );
};

const popNS: <A, Env extends BaseEnv>() => Arrow<A, A, Env> = <A, Env extends BaseEnv>() => (ra: ExtractionResult<A, Env>) => {
  return pipe(
    ra,
    TE.map(([a, env]) => {
      env.ns.pop();
      env.exitNS(env.ns);
      return asW(a, env);
    }),
    TE.mapLeft(([a, env]) => {
      env.ns.pop();
      env.exitNS(env.ns);
      return asW(a, env);
    }),
  );
};

const withNS: <A, B, Env extends BaseEnv>(name: string, arrow: Arrow<A, B, Env>) => Arrow<A, B, Env> = <A, B, Env extends BaseEnv>(name: string, arrow: Arrow<A, B, Env>) => (ra: ExtractionResult<A, Env>) => pipe(
  ra,
  pushNS(name),
  arrow,
  popNS()
);

const carryWA: <A, B, Env extends BaseEnv>(arrow: Arrow<A, B, Env>) => Arrow<A, [B, W<A, Env>], Env> = <A, B, Env extends BaseEnv>(arrow: Arrow<A, B, Env>) => {
  let origWA: W<A, Env>;

  return (ra: ExtractionResult<A, Env>) => pipe(
    ra,
    TE.map((wa) => {
      origWA = wa;
      return wa;
    }),
    arrow,
    TE.chain(([b, env]) => {
      return TE.right(asW([b, origWA], env));
    }),
  );
};


const withCarriedWA: <A, Env extends BaseEnv>(arrow: Arrow<A, unknown, Env>) => Arrow<A, A, Env> = (arrow) => ra => pipe(
  ra,
  carryWA(arrow),
  TE.map(([[_b, wa], _envb]) => wa),
);

function separateResults<A, Env extends BaseEnv>(
  extractionResults: ExtractionResult<A, Env>[]
): Task.Task<[Array<W<ControlInstruction, Env>>, Array<W<A, Env>>]> {
  return () => Async.mapSeries<ExtractionResult<A, Env>, PerhapsW<A, Env>>(
    extractionResults,
    Async.asyncify(async (er: ExtractionResult<A, Env>) => er()))
    .then((settled: PerhapsW<A, Env>[]) => {
      const lefts: WCI<Env>[] = [];
      const rights: W<A, Env>[] = [];
      _.each(settled, result => {
        if (isLeft(result)) lefts.push(result.left);
        else rights.push(result.right);
      });
      return [lefts, rights];
    });
}


// Control flow primitives
/// given as: A[]
/// given arrow: A => B
//  each(as, a => arrow(a)), then filter(isRight)
const forEachDo: <A, B, Env extends BaseEnv> (arrow: Arrow<A, B, Env>) => Arrow<A[], B[], Env> = <A, B, Env extends BaseEnv>(arrow: Arrow<A, B, Env>) => (ra: ExtractionResult<A[], Env>) => {
  return pipe(
    ra,
    TE.chain((wa: W<A[], Env>) => {
      const [aas, env] = wa;
      const bbs = _.map(aas, (a) => {
        const env0 = _.clone(env);
        return arrow(TE.right(asW<A, Env>(a, env0)));
      });
      const leftRightErrs = separateResults(bbs);
      const rightTasks = pipe(
        leftRightErrs,
        Task.map(([_lefts, rights]) => {
          const bs = _.map(rights, ([b]) => b);
          const env0 = _.clone(env);
          return asW(bs, env0);
        })
      );
      return TE.fromTask(rightTasks);
    })
  );
};


// Given a single input A, produce an array of Bs by running the given array of functions on the initial A
const gatherSuccess: <A, B, Env extends BaseEnv> (...arrows: Arrow<A, B, Env>[]) => Arrow<A, B[], Env> = <A, B, Env extends BaseEnv>(...arrows: Arrow<A, B, Env>[]) => (ra: ExtractionResult<A, Env>) => {
  return pipe(
    ra,
    scatterAndSettle(...arrows),
    TE.chain(([settledBs, env]) => {
      const bs: B[] = [];
      _.each(settledBs, (wb) => {
        if (E.isRight(wb)) {
          const [b] = wb.right;
          bs.push(b);
        } else {
          const [ci] = wb.left;
          let msg = '';
          if (typeof ci === 'string') {
            msg = ci;
          } else {
            const [code, m] = ci;
            msg = `${code}: ${m}`;
          }
          env.log.log('debug', `gatherSuccess/left = ${msg}`);
        }
      });
      return TE.right(asW(bs, env));
    })
  );
};


const scatterAndSettle: <A, B, Env extends BaseEnv> (
  ...arrows: Arrow<A, B, Env>[]
) => Arrow<A, PerhapsW<B, Env>[], Env> = <A, B, Env extends BaseEnv>(...arrows: Arrow<A, B, Env>[]) => (ra: ExtractionResult<A, Env>) => pipe(
  ra,
  TE.chain(([a, env]: W<A, Env>) => {
    const bbs = _.map(arrows, (arrow) => {
      const env0 = _.clone(env);
      return arrow(TE.right(asW(a, env0)));
    });
    const sequenced = () => Async
      .mapSeries<ExtractionResult<B, Env>, PerhapsW<B, Env>>(
        bbs,
        Async.asyncify(async (er: ExtractionResult<A, Env>) => er())
      );
    const pBsTask = pipe(
      sequenced,
      Task.map((perhapsBs) => asW(perhapsBs, env))
    );
    return TE.fromTask(pBsTask);
  })
);

// Compose arrows
const takeWhileSuccess: <A, Env extends BaseEnv> (...arrows: Arrow<A, A, Env>[]) => Arrow<A, A, Env> = (...arrows) => withNS(
  `takeWhileSuccess:${arrows.length}`,
  __takeWhileSuccess(arrows, arrows.length)
);

const __takeWhileSuccess: <A, Env extends BaseEnv> (arrows: Arrow<A, A, Env>[], arrowCount: number) => Arrow<A, A, Env> = <A, Env extends BaseEnv>(arrows: Arrow<A, A, Env>[], arrowCount: number) => (ra: ExtractionResult<A, Env>) => {
  // Base Case:
  if (arrows.length === 0) return ra;

  // Recursive Step:
  const headArrow: Arrow<A, A, Env> = arrows[0];
  const tailArrows: Arrow<A, A, Env>[] = arrows.slice(1);
  const arrowNum = arrowCount - arrows.length;
  const ns = `#${arrowNum}`;

  return pipe(
    ra,
    withCarriedWA(withNS(
      ns,
      headArrow
    )),
    __takeWhileSuccess(tailArrows, arrowCount)
  );
};

// Try each arrow on input until one succeeds
// const eachOrElse: <A, B, Env extends BaseEnv> (...arrows: Arrow<A, B, Env>[]) => Arrow<A, B, Env> = (...arrows) => withNS(
//   `eachOrElse:`,
//   __eachOrElse(arrows, arrows.length),
// );
const eachOrElse: <A, B, Env extends BaseEnv> (...arrows: Arrow<A, B, Env>[]) => Arrow<A, B, Env> = (...arrows) => __eachOrElse(arrows, arrows.length);


const __eachOrElse: <A, B, Env extends BaseEnv> (arrows: Arrow<A, B, Env>[], arrowCount: number) => Arrow<A, B, Env> = (arrows, arrowCount) => (ra) => {
  // Base Case:
  if (arrows.length === 0) {
    return pipe(
      ra,
      TE.chain(([, env]) => {
        return TE.left(asWCI('continue', env));
      })
    );
  }

  // Recursive Step:
  const headArrow = arrows[0];
  const tailArrows = arrows.slice(1);
  const arrowNum = arrowCount - arrows.length;
  const ns = `eachOrElse(${arrowNum} of ${arrowCount})`;

  return pipe(
    ra,
    TE.chain(([a, env]) => {
      const origWA = TE.right(asW(a, env));

      const headAttempt = pipe(origWA, withNS(ns, headArrow));
      const fallback = pipe(origWA, __eachOrElse(tailArrows, arrowCount));

      return TE.orElse(() => fallback)(headAttempt);
    }),
  );
};

const hook: <A, B, Env extends BaseEnv>(f: (a: A, b: Perhaps<B>, env: Env) => void) =>
  PostHook<A, B, Env> = (f) => f;

function shortFormat(v: any): string {
  if (_.isArray(v)) {
    return _.join(_.map(v, shortFormat), ', ');
  }
  if (_.isObject(v)) {
    const cname = v?.constructor?.name;
    if (cname !== undefined) {
      return cname;
    }
    const pretty = prettyFormat(v);
    const line0 = pretty.split('\n')[0];
    return line0.substring(0, 50);
  }
  return prettyFormat(v).substring(0, 50);
}

function through<A, B, Env extends BaseEnv>(
  f: ClientFunc<A, B, Env>,
  name: string,
  postHook?: PostHook<A, B, Env>,
): Arrow<A, B, Env> {
  const ns = name ? `exec:${name}` : 'exec:anon';

  const mhook = <A>() => hook<A, B, Env>((a, b, env) => {
    const msg = pipe(b, E.fold(
      (ci) => `control(${ci}): ${shortFormat(a)} `,
      (res) => `${shortFormat(a)} => ${shortFormat(res)}`
    ));
    env.log.info(msg);
  });

  const fhook = postHook || name ? mhook() : undefined;
  return (ra) => pipe(
    ra,
    pushNS(ns),
    Arrow.lift(f, fhook),
    popNS(),
  );
}

function throughLeft<A, Env extends BaseEnv>(
  f: ControlFunc<Env>,
): Arrow<A, A, Env> {
  return (ra) => pipe(
    ra,
    TE.mapLeft(([ci, env]) => {
      const fres = f(ci, env);
      const ci0 = fres || ci;
      return asW(ci0, env);
    }),
  );
}

function tapLeft<A, Env extends BaseEnv>(
  f: ControlFunc_<Env>,
): Arrow<A, A, Env> {
  return (ra) => pipe(
    ra,
    TE.mapLeft(([ci, env]) => {
      f(ci, env);
      return asW(ci, env);
    }),
  );
}

function tap<A, Env extends BaseEnv>(f: ClientFunc<A, unknown, Env>, name?: string): Arrow<A, A, Env> {
  const ns = name ? `tap:${name}` : 'tap';
  return withCarriedWA(
    withNS(ns, Arrow.lift(f))
  );
}

function liftFilter<A, Env extends BaseEnv>(
  f: ClientFunc<A, boolean, Env>,
  name?: string,
  postHook?: PostHook<A, boolean, Env>,
): Arrow<A, boolean, Env> {
  const filterHook = <A>() => hook<A, A, Env>((a, b, env) => {
    const msg = pipe(b, E.fold(
      (ci) => `( ${shortFormat(a)} ) => fail(${ci})`,
      (b0) => `( ${shortFormat(a)} ) => ${b0 ? 'pass' : 'fail'}`
    ));
    env.log.info(msg);
  });
  const fhook = postHook || name ? filterHook() : undefined;

  return Arrow.lift<A, boolean, Env>(f, fhook);
}

function filter<A, Env extends BaseEnv>(
  f: ClientFunc<A, boolean, Env>,
  name?: string,
  postHook?: PostHook<A, boolean, Env>,
): FilterArrow<A, Env> {
  const fa: FilterArrow<A, Env> = (ra: ExtractionResult<A, Env>) => {
    const ns = name ? `filter(${name})` : 'filter(?)';

    return pipe(
      ra,
      carryWA(withNS(
        ns,
        liftFilter(f, name, postHook)
      )),
      TE.chain(([[cond, origWA], env]) => {
        return cond
          ? TE.right(origWA)
          : TE.left<WCI<Env>, W<A, Env>>(asW('halt', env));
      }),
    );
  };

  return fa;
}

export type LogLevel = 'info'
  | 'debug'
  | 'warn'
  | 'error'
  ;


const log = <A, Env extends BaseEnv>(level: LogLevel, f: (a: A, env: Env) => string) => tap((a: A, env: Env) => env.log.log(level, `${f(a, env)}`));
