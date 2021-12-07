import _ from 'lodash';
import fs from 'fs-extra';
import through from 'through2';
import stream, { Transform, Readable } from 'stream';
import split from 'split';
import { ChildProcessWithoutNullStreams } from 'child_process';
import { prettyPrint } from './pretty-print';

export interface WithEnv<T, E> {
  kind: 'WithEnv';
  t: T;
  env: E
}

export function isWithEnv(a: WithEnv<any, any> | any): a is WithEnv<any, any> {
  const isObject = typeof a === 'object';
  return isObject
    && 'kind' in a && a.kind === 'WithEnv'
    && 't' in a
    && 'env' in a;
}

// TODO Parallel stream processing not yet working
export function throughFuncPar<T, R, E>(
  parallelFactor: number,
  f: (t: T, env: E, currTransform: Transform) => R,
): Transform {
  let buffer: R[] = [];
  let envs: E[] = [];

  const chunker = through.obj(
    function(chunk: [T, E], _enc: string, next: (err: any, v: any) => void) {
      const self = this;
      const [data, env] = chunk;
      const localEnv: any = _.clone(env);
      localEnv.parNum = buffer.length;

      const res = f(data, localEnv, self);
      buffer.push(res);
      envs.push(localEnv);

      if (buffer.length < parallelFactor) {
        return next(null, null);
      }

      const buf0 = buffer;
      const envs0 = envs;
      buffer = [];
      envs = [];

      Promise.all(buf0.map(t => Promise.resolve(t)))
        .then(res => {
          _.each(res, (r: R, i: number) => this.push([r, envs0[i]]));
          next(null, null);
        });
    },
    function flush(cb) {
      Promise.all(buffer.map(t => Promise.resolve(t)))
        .then(res => {
          _.each(res, (r: R, i: number) => this.push([r, envs[i]]));
        })
        .then(() => cb())
      ;
    },
  );
  return chunker;
}

export function tapStream<T, Env>(f: (t: T, env: Env) => void): Transform {
  return through.obj(
    async (chunk: T | WithEnv<T, Env>, _enc: string, next: (err: any, v: any) => void) => {
      const [t, env] = unEnv(chunk);
      return Promise.resolve(f(t, env))
        .then(() => next(null, chunk));
    }
  );
}

export function initEnv<T, E>(
  f: (t: T) => E,
): Transform {
  return through.obj(
    (chunk: T, _enc: string, next: (err: any, v: any) => void) => {
      const initEnv = f(chunk);
      Promise.resolve(initEnv)
        .then((env) => next(null, { kind: 'WithEnv', env, t: chunk }));
    }
  );
}

export function throughFunc<T, R, E>(
  f: (t: T, env: E) => R,
): Transform {
  return through.obj(
    (chunk: T | WithEnv<T, E>, _enc: string, next: (err: any, v: any) => void) => {
      if (isWithEnv(chunk)) {
        const { t, env } = chunk;
        const res = f(t, env);
        Promise.resolve(res)
          .then((res) => next(null, { kind: 'WithEnv', env, t: res }));

        return;
      }
      const z: E = null as any as E;
      Promise.resolve(f(chunk, z))
        .then((res) => next(null, res));
    }
  );
}


export function throughAccum<T, Acc>(
  f: (acc: Acc, t: T, onerr?: (e: any) => void) => Acc,
  init: Acc,
): Transform {
  let currAcc = init;
  const chunker = through.obj(
    (chunk: T, _enc: string, next: (err: any, v: any) => void) => {
      const newAcc = f(currAcc, chunk, (err: any) => next(err, null));
      currAcc = newAcc;
      next(null, null);
    },
    function flush(cb) {
      this.push(currAcc);
      cb();
    },
  );
  return chunker;
}

export function handlePumpError(error: Error): void {
  if (error) {
    console.log('Error:', error);
  }
}

export function unEnv<T, Env>(tdata: T | WithEnv<T, Env>): [T, Env] {
  let t: T;
  let env: Env;
  if (isWithEnv(tdata)) {
    t = tdata.t;
    env = tdata.env;
  } else {
    t = tdata;
    env = null as any as Env;
  }

  return [t, env];
}

export function filterStream<T, Env>(f: (t: T, env: Env) => boolean): Transform {
  return through.obj(
    (chunk: T | WithEnv<T, Env>, _enc: string, next: (err: any, v: any) => void) => {
      let chunkData: T;
      let z: Env;
      if (isWithEnv(chunk)) {
        chunkData = chunk.t;
        z = chunk.env;
      } else {
        chunkData = chunk;
        z = null as any as Env;
      }

      const res = f(chunkData, z);
      if (res) {
        next(null, chunk);
        return;
      }
      next(null, null);
    }
  );
}

export function prettyPrintTrans(msg: string): Transform {
  return through.obj(
    (data: any, _enc: string, next: (err: any, v: any) => void) => {
      prettyPrint({ msg, data });
      return next(null, data);
    },
  );
}

export function sliceStream(start: number, len: number): Transform {
  let currIndex = -1;
  return through.obj((
    chunk: any,
    _enc: string,
    next: (err: any, v: any) => void,
  ) => {
    currIndex++;
    if (start <= currIndex) {
      if (currIndex < start + len) {
        return next(null, chunk);
      }
      return next(null, null);
    }
    return next(null, null);
  });
}

export function progressCount(everyN?: number): Transform {
  let currIndex = 0;
  const outputOn = everyN || 1;
  return through.obj(
    (chunk: any, _enc: string, next: (err: any, v: any) => void) => {
      if (currIndex % outputOn === 0) {
        console.log(`progress: ${currIndex}`);
      }
      currIndex++;
      return next(null, chunk);
    },
  );
}

export function createReadLineStream(filename: string): Readable {
  return fs.createReadStream(filename)
    .pipe(split());
}

/**
 * Turn a stream of text lines into a stream of multi-line string blocks   (stanzas)
 * TODO this does not yet work very well...
 */
export function stanzaChunker(
  testStart: (s: string) => boolean,
  testEnd: (s: string) => boolean,
  // opts?: {
  //   beginOffset?: number;
  //   endOffset?: number;
  // },
): Transform {
  let stanzaBuffer: string[] = [];
  let state = 'awaiting-start';

  const chunker = through.obj(
    (line: string, _enc: string, cb) => {
      const isStart = testStart(line);
      const isEnd = testEnd(line);

      if (state === 'awaiting-start' && isStart) {
        stanzaBuffer = [];
        stanzaBuffer.push(line);
        state = 'in-stanza';
      } else if (state === 'in-stanza') {
        stanzaBuffer.push(line);
      }

      if (isEnd) {
        state = 'awaiting-start';
        const stanza = _.join(stanzaBuffer, '');
        stanzaBuffer = [];
        return cb(null, stanza);
      }

      return cb(null, null);
    },
    (cb) => {
      // TODO handle error if buffer has leftovers w/o seeing end marker
      cb();
    },
  );
  return chunker;
}

export function chunkStream<T>(
  chunkSize: number
): Transform {
  let buffer: T[] = [];

  const chunker = through.obj(
    (data: T, _enc: string, next: (err: any, v: any) => void) => {
      if (buffer.length === chunkSize) {
        const r = buffer;
        buffer = [];
        return next(null, r);
      }

      buffer.push(data);
      return next(null, null);
    },
    function flush(cb) {
      this.push(buffer);
      cb();
    },
  );
  return chunker;
}


/**
 * Create a Readable stream of chars by splitting string
 */
export function charStream(str: string): Readable {
  async function* genstr(s: string) {
    yield* s;
  }
  return Readable.from(genstr(str));
}

export function arrayStream(arr: any[]): Readable {
  async function* genstr(a: any[]) {
    yield* a;
  }
  return Readable.from(genstr(arr));
}

export async function promisifyReadableEnd(readStream: Readable): Promise<void> {
  return new Promise((resolve) => {
    readStream.on('end', () => {
      resolve();
    });
    readStream.on('data', () => {});
  });
}

export async function promisifyOn<T>(ev: string, readStream: Readable): Promise<T> {
  return new Promise((resolve) => {
    readStream.on(ev, (d: T) => {
      resolve(d);
    });
  });
}

export function isDefined<T>(t: T | undefined | null): t is T {
  return !_.isNil(t);
}

export interface TransformProcess {
  outStream: Readable;
  errStream: Readable;
  completePromise: Promise<number>;
}

export function streamifyProcess(
  proc: ChildProcessWithoutNullStreams
): TransformProcess {
  const outStreamR = new stream.Readable({
    read() { /* noop */ }
  });

  const errStreamR = new stream.Readable({
    read() { /* noop */ }
  });

  proc.stdout.on('data', (data) => {
    outStreamR.push(data);
  });

  proc.stderr.on('data', (data) => {
    errStreamR.push(data);
  });


  const procClose = new Promise<number>((resolve) => {
    proc.on('close', (code: number) => {
      outStreamR.push(null);
      errStreamR.push(null);
      resolve(code);
    });
  });

  const outStream = outStreamR
    .pipe(split())
    .pipe(throughFunc((t: string) => {
      return t;
    }))
  ;
  const errStream = errStreamR
    .pipe(split())
    .pipe(throughFunc((t: string) => {
      return t;
    }))
  ;

  return {
    completePromise: procClose,
    outStream,
    errStream,
  };
}
