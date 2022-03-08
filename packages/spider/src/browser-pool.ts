import gpool from 'generic-pool';
import {
  Browser, Page,
} from 'puppeteer';
import { Logger } from 'winston';
import { logBrowserEvent, logPageEvents } from './page-event';

import { launchBrowser } from './puppet';

export interface BrowserPool {
  factory: gpool.Factory<BrowserInstance>;
  pool: gpool.Pool<BrowserInstance>;
  acquire(): Promise<BrowserInstance>;
  release(b: BrowserInstance): Promise<void>;
  use<A>(f: (browser: BrowserInstance) => A | Promise<A>): Promise<A>;
  shutdown(): Promise<void>;
}
export interface BrowserInstance {
  browser: Browser;
  pid(): number;
  logPrefix: string;
  createdAt: Date;
  newPage(): Promise<PageInstance>;
}

export interface PageInstance {
  page: Page;
  logPrefix: string;
  createdAt: Date;
}

export function createBrowserPool(log: Logger): BrowserPool {

  const factory: gpool.Factory<BrowserInstance> = {
    async create(logPrefix: string = ''): Promise<BrowserInstance> {
      return launchBrowser().then(browser => {
        const browserInstance: BrowserInstance = {
          browser,
          pid(): number {
            const proc = browser.process();
            if (proc === null) return -1;
            const pid = proc.pid;
            return pid === undefined ? -1 : pid;
          },
          logPrefix,
          createdAt: new Date(),
          async newPage(): Promise<PageInstance> {
            const page = await browser.newPage()
            logPageEvents(page, log);
            return {
              page,
              logPrefix,
              createdAt: new Date(),
            }
          }
        };
        logBrowserEvent(browserInstance, log);
        const bproc = browser.process();
        if (bproc !== null) {
          bproc.on('close', (_signum: number, signame: NodeJS.Signals) => {
            log.warn(`Browser#${browserInstance.pid()} onClose: ${signame}`);
          });
          bproc.on('error', (_signum: number, signame: NodeJS.Signals) => {
            log.warn(`Browser#${browserInstance.pid()} onError: ${signame}`);
          });
          bproc.on('exit', (_signum: number, signame: NodeJS.Signals) => {
            log.warn(`Browser#${browserInstance.pid()} onExit: ${signame}`);
          });
        }
        return browserInstance;
      }).catch(error => {
        console.log(error);
        throw error;
      })
    },
    async destroy(browserInstance: BrowserInstance): Promise<void> {
      const browser = browserInstance.browser;
      return browser.close()
        .then(async () => {
          log.debug(`Browser#${browserInstance.pid()} closed`);
        })
        .catch(async (error) => {
          log.warn(`Browser#${browserInstance.pid()} close error: ${error}`);
        });
    },
    // async validate(browserInstance: BrowserInstance): Promise<boolean> { }
  };
  const opts: gpool.Options = {
    max: 5, // maximum size of the pool
    min: 1, // minimum size of the pool
    testOnBorrow: false, // should the pool validate resources before giving them to clients. Requires that factory.validate is specified.
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
    async acquire(): Promise<BrowserInstance> {
      return pool.acquire();
    },
    async release(b: BrowserInstance): Promise<void> {
      // Using destroy here b/c browsers that hang or are killed unexpectedly
      // are not able to reliably recover into a good state, and it is
      // difficult to detect whether a released browser is in a good or
      // bad state
      log.debug(`releasing (via destroy) Browser#${b.pid()}`);
      return pool.destroy(b).catch(error => {
        log.warn(`...destroy() error: Browser#${b.pid()}: ${error}`);
      });
      // return pool.release(b).catch(error => {
      //   log.warn(`...release() error: Browser#${b.pid()}: ${error}`);
      // });
    },
    async use<A>(f: (browser: BrowserInstance) => A | Promise<A>): Promise<A> {
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
