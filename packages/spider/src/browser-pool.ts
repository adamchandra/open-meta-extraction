import gpool from 'generic-pool';
import {
  Browser,
} from 'puppeteer';

import { launchBrowser } from './puppet';

export interface BrowserPool {
  factory: gpool.Factory<Browser>;
  pool: gpool.Pool<Browser>;
  acquire(): Promise<Browser>;
  release(b: Browser): Promise<void>;
  use<A>(f: (browser: Browser) => A | Promise<A>): Promise<A>;
  shutdown(): Promise<void>;
}

export function createBrowserPool(): BrowserPool {
  const factory: gpool.Factory<Browser> = {
    create: launchBrowser,
    async destroy(browser: Browser): Promise<void> {
      return browser.close();
    },
    async validate(b: Browser): Promise<boolean> {
      return b.isConnected();
    }
  };
  const opts: gpool.Options = {
    max: 5, // maximum size of the pool
    min: 1, // minimum size of the pool
    testOnBorrow: true, // should the pool validate resources before giving them to clients. Requires that factory.validate is specified.
    autostart: true, // boolean, should the pool start creating resources, initialize the evictor, etc once the constructor is called. If false, the pool can be started by calling pool.start, otherwise the first call to acquire will start the pool. (default true)
    idleTimeoutMillis: 30000, // the minimum amount of time that an object may sit idle in the pool before it is eligible for eviction due to idle time. Supercedes softIdleTimeoutMillis Default: 30000
    // maxWaitingClients: maximum number of queued requests allowed, additional acquire calls will be callback with an err in a future cycle of the event loop.
    // acquireTimeoutMillis: max milliseconds an acquire call will wait for a resource before timing out. (default no limit), if supplied should non-zero positive integer.
    // destroyTimeoutMillis: max milliseconds a destroy call will wait for a resource before timing out. (default no limit), if supplied should non-zero positive integer.
    // fifo : if true the oldest resources will be first to be allocated. If false the most recently released resources will be the first to be allocated. This in effect turns the pool's behaviour from a queue into a stack. boolean, (default true)
    // priorityRange: int between 1 and x - if set, borrowers can specify their relative priority in the queue if no resources are available. see example. (default 1)
    // evictionRunIntervalMillis: How often to run eviction checks. Default: 0 (does not run).
    // numTestsPerEvictionRun: Number of resources to check each eviction run. Default: 3.
    // softIdleTimeoutMillis: amount of time an object may sit idle in the pool before it is eligible for eviction by the idle object evictor (if any), with the extra condition that at least "min idle" object instances remain in the pool. Default -1 (nothing can get evicted)
    // Promise: Promise lib, a Promises/A+ implementation that the pool should use. Defaults to whatever global.Promise is (usually native promises).
  };

  const pool = gpool.createPool(factory, opts);
  return {
    factory,
    pool,
    acquire(): Promise<Browser> {
      return pool.acquire();
    },
    release(b: Browser): Promise<void> {
      return pool.release(b);
    },
    async use<A>(f: (browser: Browser) => A | Promise<A>): Promise<A> {
      return pool.use(f)
        .then(async (a: A | Promise<A>): Promise<A> => {
          return Promise.resolve(a);
        });
    },
    async shutdown() {
      await pool.drain()
      await pool.clear();
    }
  };
}