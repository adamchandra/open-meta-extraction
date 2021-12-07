import _ from 'lodash';
import pumpify from 'pumpify';
import { Stream, Readable } from 'stream';
import { throughFunc, tapStream, filterStream, throughAccum, initEnv, WithEnv, unEnv, isWithEnv } from './stream-utils';

export type WithoutEnvCallback<ChunkT, R = void> = (data: ChunkT) => R;
export type JustEnvCB<Env> = (env: Env) => void;
export type WithEnvCB<ChunkT, Env, R = void> = (data: ChunkT, env: Env) => R;
export type WithEnvCBAdapted<ChunkT, Env, R = void> = (data: ChunkT | WithEnv<ChunkT, Env>) => R;

/**
 * Convenience builder for stream processes
 */
export interface PumpBuilder<ChunkT, Env> {
  streams: Stream[];
  onDataF?: WithEnvCB<ChunkT, Env>;

  onCloseF?: (err: Error) => void;
  onEndF?: () => void;

  initEnv<E0>(f: (t?: ChunkT) => E0): PumpBuilder<ChunkT, E0>;

  viaStream<R>(s: Stream): PumpBuilder<R, Env>;

  throughF<R>(f: WithEnvCB<ChunkT, Env, Promise<R>>): PumpBuilder<R, Env>;
  throughF<R>(f: WithEnvCB<ChunkT, Env, R>): PumpBuilder<R, Env>;

  guard<T extends ChunkT>(f: (t: ChunkT, env: Env) => t is T): PumpBuilder<T, Env>;
  filter(f: (t: ChunkT, env: Env) => boolean): PumpBuilder<ChunkT, Env>;

  gather(): PumpBuilder<ChunkT[], Env>;

  tap(f: WithEnvCB<ChunkT, Env>): PumpBuilder<ChunkT, Env>;

  onData(f: WithEnvCB<ChunkT, Env>): PumpBuilder<ChunkT, Env>;
  onClose(f: (err?: Error) => void): PumpBuilder<ChunkT, Env>;
  onEnd(f: () => void): PumpBuilder<ChunkT, Env>;
  start(): Stream;
  toStream(): Stream;
  toReadableStream(): Readable;
  toPromise(): Promise<ChunkT | undefined>;
}

type PartialPB<T, Env> = Partial<PumpBuilder<T, Env>>;

function appendStream<ChunkT, Env>(
  builder: PumpBuilder<ChunkT, Env>,
  vstr: Stream,
): PumpBuilder<any, any> {
  const newBuilder: PumpBuilder<any, any> = _.merge(
    {},
    builder,
    { streams: _.concat(builder.streams, [vstr]) },
  );

  return newBuilder;
}

function bufferChunks<ChunkT, Env>(pb: PumpBuilder<ChunkT, Env>) {
  const init: ChunkT[] = [];
  return appendStream(pb, throughAccum(
    (acc: ChunkT[],
      chunk: ChunkT | WithEnv<ChunkT, Env>,
      _onerr?: (e: any) => void
    ) => {
      const [t,] = unEnv(chunk);
      acc.push(t);
      return acc;
    },
    init
  ));
}

function adaptOnDataFn<ChunkT, Env>(f: WithEnvCB<ChunkT, Env>): WithEnvCBAdapted<ChunkT, Env> {
  return (data: ChunkT | WithEnv<ChunkT, Env>) => {
    if (isWithEnv(data)) {
      f(data.t, data.env);
      return;
    }
    const env: Env = undefined as any as Env;
    f(data, env);
  };
}

export function createPump<ChunkT, Env = undefined>(): PumpBuilder<ChunkT, Env> {
  const merge = (builder: PumpBuilder<ChunkT, Env>, part: PartialPB<ChunkT, Env>) => _.merge({}, builder, part);

  const pb0: PumpBuilder<ChunkT, Env> = {
    streams: [],

    onData(f: WithEnvCB<ChunkT, Env>): PumpBuilder<ChunkT, Env> {
      return merge(this, { onDataF: adaptOnDataFn(f) });
    },
    onClose(f: (err?: Error) => void): PumpBuilder<ChunkT, Env> {
      return merge(this, { onCloseF: f });
    },

    onEnd(f: () => void): PumpBuilder<ChunkT, Env> {
      return merge(this, { onEndF: f });
    },
    throughF<R>(f: (t: ChunkT, env: Env) => R): PumpBuilder<R, Env> {
      return appendStream(this, throughFunc<ChunkT, R, Env>(f));
    },
    guard<T extends ChunkT>(f: (t: ChunkT, env: Env) => t is T): PumpBuilder<T, Env> {
      return appendStream(this, filterStream(f));
    },
    filter(f: (t: ChunkT, env: Env) => boolean): PumpBuilder<ChunkT, Env> {
      return appendStream(this, filterStream(f));
    },
    gather(): PumpBuilder<ChunkT[], Env> {
      return bufferChunks(this);
    },
    initEnv<Env0>(f: (t?: ChunkT) => Env0): PumpBuilder<ChunkT, Env0> {
      return appendStream(this, initEnv(f));
    },
    viaStream<R>(s: Stream): PumpBuilder<R, Env> {
      return appendStream(this, s);
    },
    tap(f: (t: ChunkT, env: Env) => void): PumpBuilder<ChunkT, Env> {
      return appendStream(this, tapStream(f));
    },
    start(): Stream {
      const strm = this.toStream();
      if (!this.onDataF) {
        strm.on('data', () => {});
      }
      return strm;
    },
    toStream(): Stream {
      const pipe = pumpify.obj(this.streams);
      if (this.onCloseF) {
        pipe.on('close', this.onCloseF);
      }
      if (this.onEndF) {
        pipe.on('end', this.onEndF);
      }
      if (this.onDataF) {
        pipe.on('data', this.onDataF);
      }
      return pipe;
    },

    toReadableStream(): Readable {
      const pipe = pumpify.obj(this.streams);
      if (this.onCloseF) {
        pipe.on('close', this.onCloseF);
      }
      if (this.onEndF) {
        pipe.on('end', this.onEndF);
      }
      if (this.onDataF) {
        pipe.on('data', this.onDataF);
      }
      return pipe;
    },

    toPromise(): Promise<ChunkT | undefined> {
      const self = this;

      return new Promise((resolve) => {
        const selfStream = self.toStream();
        let lastChunk: ChunkT | undefined;
        selfStream.on('end', () => {
          resolve(lastChunk);
        });
        selfStream.on('data', (data) => {
          lastChunk = data;
        });
      });
    }

  };
  return pb0;
}
