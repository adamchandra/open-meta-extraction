import _ from 'lodash';

import { Readable } from 'stream';
import { createPump } from './stream-pump';
import { arrayStream, isDefined } from './stream-utils';
import { prettyPrint } from './pretty-print';

describe('Pump Builder', () => {
  it('return pump as a promise', done => {
    const astr = arrayStream('0 1 2 -30 100'.split(' '));
    const expected = [0, 1, 2, -30, 100];
    const pumpBuilder = createPump()
      .viaStream<string>(astr)
      .throughF((d) => Number.parseInt(d))
      .onData((d) => {
        const n = expected.shift();
        expect(d).toBe(n);
      });

    const p = pumpBuilder.toPromise();

    p.then(() => {
      console.log('promise complete!');
      done();
    });
  });

  it('should compose pipeline function with type safety', done => {
    const f1: (s: string) => string[] = s => s.split(' ');
    const f2: (s: string[]) => number[] = s => s.map(s0 => Number.parseInt(s0));
    const astr = arrayStream(['0 1 2 -30 100']);
    const expected = [0, 1, 2, -30, 100];

    const pumpBuilder = createPump()
      .viaStream<string>(astr)
      .throughF(f1)
      .throughF(f2)
      .onData((d) => {
        // prettyPrint({ msg: `data (${typeof d})  `, d });
        expect(d).toEqual(expected);
      })
      .onEnd(() => done());

    pumpBuilder.start();
  });

  const numberStream = (start: number, end: number): Readable => {
    return arrayStream(_.range(start, end));
  };

  it('should filter a stream', done => {
    const astr = numberStream(1, 10);
    const expected = [2, 4, 6, 8];

    const pumpBuilder = createPump()
      .viaStream<number>(astr)
      .filter(n => n % 2 === 0)
      .gather()
      .onData((d) => {
        expect(d).toEqual(expected);
      });

    pumpBuilder.toPromise().then(() => done());
  });


  it('should narrow types when filtering', done => {
    const astr = numberStream(1, 10);

    const pumpBuilder = createPump()
      .viaStream<number>(astr)
      .throughF((n) => {
        if (n %2 === 0) {
          return n;
        }
      })
      .guard(isDefined)
      .onData((data) => {
        prettyPrint({ data });
      });

    pumpBuilder.toPromise().then(() => done());
  });

  it('should include an Env', done => {
    const astr = numberStream(1, 10);
    // const expected = [2, 4, 6, 8];

    interface MyEnv {
      accum: number;
      msgs: string[];
    }

    const pumpBuilder = createPump()
      .viaStream<number>(astr)
      .initEnv<MyEnv>(() => ({ accum: 0, msgs: [] }))
      .filter((n: number) => n % 2 === 0)
      .throughF((n: number) => n + 1)
      .throughF((n: number, env: MyEnv) => {
        const { msgs } = env;
        msgs.push(`iteration ${n}`);
        return n;
      })
      .throughF((n: number) => n * 10)
      .tap((n: number, env: MyEnv) => {
        env.msgs.push(`iteration ${n}`);
      })
      .tap((n: number, env: MyEnv) => {
        env.accum += n;
      })
      .onData((d, env) => {
        expect(d).toEqual(env.accum);
        expect(typeof d).toEqual('number');
      });

    pumpBuilder.toPromise().then(() => done());
  });

  it('should gather with or without an Env', done => {
    const astr = numberStream(1, 10);

    interface MyEnv {
      accum: number;
    }

    const pumpBuilder = createPump()
      .viaStream<number>(astr)
      .initEnv<MyEnv>(() => ({ accum: 0 }))
      .filter((n: number) => n % 2 === 0)
      .throughF((n: number) => n + 1)
      .tap((n: number, env: MyEnv) => {
        env.accum += n;
      })
      .gather()
      .onData((d) => {
        prettyPrint({ d });
      });

    pumpBuilder.toPromise().then(() => done());
  });

  it('should convert to promise that yield data', done => {
    const astr = numberStream(1, 10);

    interface MyEnv {
      accum: number;
    }
    const pumpBuilder = createPump()
      .viaStream<number>(astr)
      .initEnv<MyEnv>(() => ({ accum: 0 }))
      .filter((n: number) => n % 2 === 0)
      .throughF((n: number) => n + 1)
      .tap((n: number, env: MyEnv) => {
        env.accum += n;
      })
      .gather()
    ;

    pumpBuilder.toPromise().then(result => {
      expect(result).toEqual([3, 5, 7, 9]);
      done();
    });
  });
});
