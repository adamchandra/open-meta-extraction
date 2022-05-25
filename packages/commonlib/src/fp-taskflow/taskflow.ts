import _ from 'lodash';

import { pipe, flow as fptsFlow  } from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import * as Task from 'fp-ts/Task';
import * as E from 'fp-ts/Either';
import { isLeft } from 'fp-ts/Either';
import { Logger } from 'winston';
import Async from 'async';
import { prettyFormat } from '~/util/pretty-print';

export interface FPackage<Env extends BaseEnv> {
  asW<A>(a: A, w: Env): W<A, Env>;
  asWCI(ci: ControlInstruction, w: Env): WCI<Env>;

  // Pair an Transform function with a runtime Env
  withNS: <A, B>(name: string, arrow: Transform<A, B, Env>) => Transform<A, B, Env>;
  withCarriedWA: <A, Env extends BaseEnv>(arrow: Transform<A, unknown, Env>) => Transform<A, A, Env>;
  through<A, B>(f: ClientFunc<A, B, Env>, name?: string, postHook?: LogHook<A, B, Env>,): Transform<A, B, Env>;
  throughLeft<A>(f: ControlFunc<Env>): Transform<A, A, Env>;
  tapLeft<A>(f: ControlFunc_<Env>): Transform<A, A, Env>;
  tapEitherEnv<A>(f: (e: Env) => unknown): Transform<A, A, Env>;
  tap<A>(f: ClientFunc<A, unknown, Env>, name?: string): Transform<A, A, Env>;
  filter<A>(f: ClientFunc<A, boolean, Env>, name?: string, postHook?: LogHook<A, boolean, Env>,): FilterTransform<A, Env>;

  forEachDo: <A, B> (arrow: Transform<A, B, Env>) => Transform<A[], B[], Env>;

  collectFanout: <A, B> (...arrows: Transform<A, B, Env>[]) => Transform<A, B[], Env>;
  takeWhileSuccess: <A, Env extends BaseEnv> (...arrows: Transform<A, A, Env>[]) => Transform<A, A, Env>;
  attemptEach: <A, B> (...arrows: Transform<A, B, Env>[]) => Transform<A, B, Env>;

  log: <A>(level: LogLevel, f: (a: A, env: Env) => string) => Transform<A, A, Env>;

  Transform: {
    lift: <A, B>(
      fab: ClientFunc<A, B, Env>,
      postHook?: (a: A, eb: Perhaps<B>, env: Env) => void,
    ) => Transform<A, B, Env>;
  };


  ExtractionTask: {
    lift: <A>(a: Eventual<A>, env: Env) => ExtractionTask<A, Env>;
    liftW: <A>(wa: Eventual<W<A, Env>>) => ExtractionTask<A, Env>;
    liftFail: <A>(ci: Eventual<ControlInstruction>, env: Env) => ExtractionTask<A, Env>;
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
    collectFanout,
    attemptEach,
    takeWhileSuccess,
    through,
    throughLeft,
    tapLeft,
    tapEitherEnv,
    tap,
    filter,
    log,
    Transform,
    ExtractionTask,
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
export type W<A, Env extends BaseEnv> = [a: A, env: Env];
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

export type LogHook<A, B, Env extends BaseEnv> = (a: A, eb: Perhaps<B>, env: Env) => void;

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

// Basic type representing either success/fail for extracting a value A with an Environment Env
export type ExtractionTask<A, Env extends BaseEnv> = TE.TaskEither<WCI<Env>, W<A, Env>>;

const ExtractionTask = {
  lift: <A, Env extends BaseEnv>(a: Eventual<A>, env: Env): ExtractionTask<A, Env> => () => Promise.resolve<A>(a).then(a0 => E.right(asW(a0, env))),

  liftW: <A, Env extends BaseEnv>(wa: Eventual<W<A, Env>>): ExtractionTask<A, Env> => () => Promise.resolve<W<A, Env>>(wa).then(wa0 => E.right(wa0)),

  liftFail: <A, Env extends BaseEnv>(ci: Eventual<ControlInstruction>, env: Env): ExtractionTask<A, Env> => () => Promise.resolve<ControlInstruction>(ci).then(ci0 => E.left(asW(ci0, env))),
};

export interface Transform<A, B, Env extends BaseEnv> {
  (ra: ExtractionTask<A, Env>): ExtractionTask<B, Env>;
}

const Transform = {
  lift: <A, B, Env extends BaseEnv>(
    fab: ClientFunc<A, B, Env>,
    postHook?: (a: A, eb: Perhaps<B>, env: Env) => void,
  ): Transform<A, B, Env> => (er: ExtractionTask<A, Env>) => pipe(er, TE.fold(
    ([controlInstruction, env]) => {
      return ExtractionTask.liftFail(controlInstruction, env);
    },
    ([prev, env]) => {
      return () => Promise.resolve(fab(prev, env))
        .then(async (result) => {

          if (isELeft(result)) {
            const ci = result.left;
            //
            if (postHook) {
              postHook(prev, result, env);
            }
            return EventualResult.liftFail<B, Env>(ci, env);
          }
          if (isERight(result)) {
            const b = result.right;
            ///
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


export type FilterTransform<A, Env extends BaseEnv> = Transform<A, A, Env>;
export type ExtractionFunction<A, B, Env extends BaseEnv> = (a: A, env: Env) => ExtractionTask<B, Env>;
export type FilterFunction<A, Env extends BaseEnv> = ExtractionFunction<A, A, Env>;
export type EnvFunction<B, Env extends BaseEnv> = ExtractionFunction<void, B, Env>;

export const compose: typeof fptsFlow = (...fs: []) =>
  <A extends readonly unknown[]>(a: A) =>
    pipe(a, ...fs);

const pushNS:
<A, Env extends BaseEnv>(name: string) => Transform<A, A, Env> =
  <A, Env extends BaseEnv>(name: string) => (ra: ExtractionTask<A, Env>) => {
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

const popNS:
<A, Env extends BaseEnv>() => Transform<A, A, Env> =
  <A, Env extends BaseEnv>() => (ra: ExtractionTask<A, Env>) => {
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

const withNS:
<A, B, Env extends BaseEnv>(name: string, arrow: Transform<A, B, Env>) => Transform<A, B, Env> =
  <A, B, Env extends BaseEnv>(name: string, arrow: Transform<A, B, Env>) => (ra: ExtractionTask<A, Env>) => pipe(
    ra,
    pushNS(name),
    arrow,
    popNS()
  );

const carryWA:
<A, B, Env extends BaseEnv>(arrow: Transform<A, B, Env>) => Transform<A, [B, W<A, Env>], Env> =
  <A, B, Env extends BaseEnv>(arrow: Transform<A, B, Env>) => {
    let origWA: W<A, Env>;

    return (ra: ExtractionTask<A, Env>) => pipe(
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


const withCarriedWA: <A, Env extends BaseEnv>(arrow: Transform<A, unknown, Env>) => Transform<A, A, Env> = (arrow) => ra => pipe(
  ra,
  carryWA(arrow),
  TE.map(([[_b, wa], _envb]) => wa),
);

function separateResults<A, Env extends BaseEnv>(
  extractionResults: ExtractionTask<A, Env>[]
): Task.Task<[Array<W<ControlInstruction, Env>>, Array<W<A, Env>>]> {
  return () => Async.mapSeries<ExtractionTask<A, Env>, PerhapsW<A, Env>>(
    extractionResults,
    Async.asyncify(async (er: ExtractionTask<A, Env>) => er()))
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
const forEachDo: <A, B, Env extends BaseEnv> (arrow: Transform<A, B, Env>) => Transform<A[], B[], Env> = <A, B, Env extends BaseEnv>(arrow: Transform<A, B, Env>) => (ra: ExtractionTask<A[], Env>) => {
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
          const lefts = _.map(_lefts, ([b]) => b);
          const env0 = _.clone(env);
          const leftMsg = lefts.map((ci) => `${ci}`).join(', ');
          env.log.debug(`forEachDo:lefts:${leftMsg}`);
          return asW(bs, env0);
        })
      );
      return TE.fromTask(rightTasks);
    })
  );
};


// Given a single input A, produce an array of Bs by running the given array of functions on the initial A
const collectFanout:
<A, B, Env extends BaseEnv>(...arrows: Transform<A, B, Env>[]) => Transform<A, B[], Env> =
  <A, B, Env extends BaseEnv>(...arrows: Transform<A, B, Env>[]) => (ra: ExtractionTask<A, Env>) => {
    return pipe(
      ra,
      tap((_a, { log }) => {
        log.info(`Begin fanOut(${arrows.length})`);
      }),
      withNS(`fanOut(${arrows.length})`, scatterAndSettle(...arrows)),
      TE.chain(([settledBs, env]) => {
        const bs: B[] = [];
        let fails = 0;
        _.each(settledBs, (wb) => {
          if (E.isRight(wb)) {
            const [b] = wb.right;
            bs.push(b);
          } else {
            fails += 1;
          }
        });
        env.log.debug(`End fanOut(${arrows.length}); ${bs.length}/${fails} succ/fail`);
        return TE.right(asW(bs, env));
      })
    );
  };


const scatterAndSettle: <A, B, Env extends BaseEnv> (
  ...arrows: Transform<A, B, Env>[]
) => Transform<A, PerhapsW<B, Env>[], Env> = <A, B, Env extends BaseEnv>(...arrows: Transform<A, B, Env>[]) => (ra: ExtractionTask<A, Env>) => pipe(
  ra,
  TE.chain(([a, env]: W<A, Env>) => {
    const bbs = _.map(arrows, (arrow) => {
      const env0 = _.clone(env);
      return arrow(TE.right(asW(a, env0)));
    });
    const sequenced = () => Async
      .mapSeries<ExtractionTask<B, Env>, PerhapsW<B, Env>>(
      bbs,
      Async.asyncify(async (er: ExtractionTask<A, Env>) => er())
    );
    const pBsTask = pipe(
      sequenced,
      Task.map((perhapsBs) => asW(perhapsBs, env))
    );
    return TE.fromTask(pBsTask);
  })
);

// Compose arrows
const takeWhileSuccess: <A, Env extends BaseEnv> (...arrows: Transform<A, A, Env>[]) => Transform<A, A, Env> = (...arrows) => withNS(
  `takeWhileSuccess:${arrows.length}`,
  __takeWhileSuccess(arrows, arrows.length)
);

const __takeWhileSuccess:
<A, Env extends BaseEnv>(arrows: Transform<A, A, Env>[], arrowCount: number) => Transform<A, A, Env> =
  <A, Env extends BaseEnv>(arrows: Transform<A, A, Env>[], arrowCount: number) => (ra: ExtractionTask<A, Env>) => {
    // Base Case:
    if (arrows.length === 0) return ra;

    // Recursive Step:
    const headTransform: Transform<A, A, Env> = arrows[0];
    const tailTransforms: Transform<A, A, Env>[] = arrows.slice(1);
    const arrowNum = arrowCount - arrows.length;
    const ns = `#${arrowNum}`;

    return pipe(
      ra,
      withCarriedWA(withNS(
        ns,
        headTransform
      )),
      __takeWhileSuccess(tailTransforms, arrowCount)
    );
  };

const attemptEach: <A, B, Env extends BaseEnv> (...arrows: Transform<A, B, Env>[]) => Transform<A, B, Env> =
  (...arrows) => __attemptEach(arrows, arrows.length);

const __attemptEach: <A, B, Env extends BaseEnv>(arrows: Transform<A, B, Env>[], arrowCount: number) => Transform<A, B, Env> =
  (arrows, arrowCount) => (ra) => {
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
    const headTransform = arrows[0];
    const tailTransforms = arrows.slice(1);
    const arrowNum = arrowCount - arrows.length;
    const ns = `attempt(${arrowNum + 1} of ${arrowCount})`;

    return pipe(
      ra,
      TE.chain(([a, env]) => {
        const origWA = TE.right(asW(a, env));

        const headAttempt = pipe(origWA, withNS(ns, headTransform));
        const fallback = pipe(origWA, __attemptEach(tailTransforms, arrowCount));

        return TE.orElse(() => fallback)(headAttempt);
      }),
    );
  };

const hook: <A, B, Env extends BaseEnv>(f: (a: A, b: Perhaps<B>, env: Env) => void) =>
LogHook<A, B, Env> = (f) => f;

function shortFormat(v: any): string {
  if (_.isArray(v)) {
    const shortArray = _.join(_.map(v, shortFormat), ', ');
    return `[len=${v.length}: ${shortFormat(shortArray)}]`;
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

  const prettified = prettyFormat(v.toString().trim()).substring(0, 50);
  return _.join(_.split(prettified, '\n'), ' ');
}

function through<A, B, Env extends BaseEnv>(
  f: ClientFunc<A, B, Env>,
  name?: string,
  postHook?: LogHook<A, B, Env>,
): Transform<A, B, Env> {
  const ns = name ? `do:${name}` : '';

  const mhook = <A>() => hook<A, B, Env>((a, b, env) => {
    const msg = pipe(b, E.fold(
      (ci) => `✗ ${ci}: ${shortFormat(a)} `,
      (res) => `✓ ${shortFormat(a)} => ${shortFormat(res)}`
    ));
    env.log.info(msg);
  });

  const fhook = postHook || name ? mhook() : undefined;
  return (ra) => pipe(
    ra,
    pushNS(ns),
    Transform.lift(f, fhook),
    popNS(),
  );
}

function throughLeft<A, Env extends BaseEnv>(
  f: ControlFunc<Env>,
): Transform<A, A, Env> {
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
): Transform<A, A, Env> {
  return (ra) => pipe(
    ra,
    TE.mapLeft(([ci, env]) => {
      f(ci, env);
      return asW(ci, env);
    }),
  );
}


function tapEitherEnv<A, Env extends BaseEnv>(
  f: (env: Env) => unknown
): Transform<A, A, Env> {
  return compose(
    tap((_0, env) => f(env)),
    tapLeft((_0, env) => {
      f(env);
    })
  );
}

function tap<A, Env extends BaseEnv>(f: ClientFunc<A, unknown, Env>, name?: string): Transform<A, A, Env> {
  const arrowf = Transform.lift(f);
  const tapped = name ? withNS(`tap:${name}`, arrowf) : arrowf;
  return withCarriedWA(tapped);
}

function liftFilter<A, Env extends BaseEnv>(
  f: ClientFunc<A, boolean, Env>,
  name?: string,
  postHook?: LogHook<A, boolean, Env>,
): Transform<A, boolean, Env> {
  const filterHook = <A>() => hook<A, A, Env>((a, b, env) => {
    const msg = pipe(b, E.fold(
      (ci) => `( ${shortFormat(a)} ) => fail(${ci})`,
      (b0) => `( ${shortFormat(a)} ) => ${b0 ? 'pass' : 'fail'}`
    ));
    env.log.info(msg);
  });
  const fhook = postHook || name ? filterHook() : undefined;

  return Transform.lift<A, boolean, Env>(f, fhook);
}

function filter<A, Env extends BaseEnv>(
  f: ClientFunc<A, boolean, Env>,
  name?: string,
  postHook?: LogHook<A, boolean, Env>,
): FilterTransform<A, Env> {
  const fa: FilterTransform<A, Env> = (ra: ExtractionTask<A, Env>) => {
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
