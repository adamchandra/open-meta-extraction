import _ from 'lodash';

import * as E from 'fp-ts/Either';
import onExit from 'signal-exit';
import { Pool } from 'tarn';

import {
  HTTPResponse,
  PuppeteerLifeCycleEvent
} from 'puppeteer';

import { asyncEach, getServiceLogger, prettyPrint } from '@watr/commonlib';

import {
  Browser, Page,
} from 'puppeteer';
import { interceptRequestCycle, logBrowserEvent, logPageEvents } from './page-event';

import { launchBrowser } from './puppet';
import { BlockableResource, RewritableUrl, RewritableUrls } from './resource-blocking';

export interface BrowserPool {
  pool: Pool<BrowserInstance>;
  acquire(): Promise<BrowserInstance>;
  release(b: BrowserInstance): Promise<void>;
  use<A>(f: (browser: BrowserInstance) => A | Promise<A>): Promise<A>;
  shutdown(): Promise<void>;
  report(): void;
  clearCache(): Promise<void>;
  cachedResources: Record<string, BrowserInstance>;
}

export interface BrowserInstance {
  browser: Browser;
  pid(): number;
  logPrefix: string;
  createdAt: Date;
  newPage(opts: PageInstanceOptions): Promise<PageInstance>;
  events: string[];
  isStale(): boolean;
  kill(): Promise<void>;
  asString(): string;
}

export interface PageInstance {
  page: Page;
  logPrefix: string;
  createdAt: Date;
  opts: PageInstanceOptions;
  gotoUrl(url: string): Promise<E.Either<string, HTTPResponse>>;
}

export interface PageInstanceOptions {
  cacheEnabled: boolean;
  defaultNavigationTimeout: number;
  defaultTimeout: number;
  javaScriptEnabled: boolean;
  allowedResources: BlockableResource[];
  rewriteableUrls: RewritableUrl[];
  waitUntil: PuppeteerLifeCycleEvent;
  requestInterception: boolean;
}

export const DefaultPageInstanceOptions: PageInstanceOptions = {
  cacheEnabled: false,
  defaultNavigationTimeout: 10_000,
  defaultTimeout: 10_000,
  javaScriptEnabled: false,
  allowedResources: ['document'],
  rewriteableUrls: RewritableUrls,
  waitUntil: 'domcontentloaded',
  requestInterception: true,

};

export const ScriptablePageInstanceOptions: PageInstanceOptions = {
  cacheEnabled: false,
  defaultNavigationTimeout: 10_000,
  defaultTimeout: 10_000,
  javaScriptEnabled: true,
  allowedResources: ['document', 'script'],
  rewriteableUrls: RewritableUrls,
  waitUntil: 'networkidle0',
  requestInterception: true,
};

export function createBrowserPool(logPrefix?: string): BrowserPool {
  const prefix = logPrefix ? logPrefix : '';
  const log = getServiceLogger(`${prefix}:browser-pool`);

  const pool = new Pool<BrowserInstance>({
    log(msg: string): void {
      log.info(msg);
    },
    async create(): Promise<BrowserInstance> {
      const logPrefix: string = '';
      return launchBrowser().then(browser => {
        const browserInstance: BrowserInstance = {
          browser,
          asString(): string {
            const pid = this.pid();
            return `Browser#${pid}`;
          },
          async kill(): Promise<void> {
            const bproc = this.browser.process();
            if (bproc === null) return;
            const pid = bproc.pid;
            if (pid === undefined) return;

            return new Promise(resolve => {
              bproc.removeAllListeners();

              bproc.on('exit', (_signum: number, signame: NodeJS.Signals) => {
                log.debug(`Killed Browser#${pid}: ${signame}`);
                browserInstance.events.push('exit');
                resolve();
              });

              try {
                process.kill(pid, 'SIGKILL');
              } catch (error) {
                log.debug(`process.kill() error: ${error}`);
                this.events.push('exit');
                resolve();
              }
            });

          },
          isStale(): boolean {
            const closedOrExited = this.events.some(s => s === 'close' || s === 'exit');
            return closedOrExited;
          },
          events: [],
          pid(): number {
            const proc = browser.process();
            if (proc === null) return -1;
            const pid = proc.pid;
            return pid === undefined ? -1 : pid;
          },
          logPrefix,
          createdAt: new Date(),

          async newPage(opts: PageInstanceOptions): Promise<PageInstance> {
            const page = await browser.newPage();
            page.setDefaultNavigationTimeout(opts.defaultNavigationTimeout);
            page.setDefaultTimeout(opts.defaultTimeout);
            page.setJavaScriptEnabled(opts.javaScriptEnabled);
            page.setRequestInterception(opts.requestInterception);

            const pageInstance: PageInstance = {
              page,
              logPrefix,
              createdAt: new Date(),
              opts,
              gotoUrl(url: string): Promise<E.Either<string, HTTPResponse>> {
                return gotoUrlSimpleVersion(this, url);
              }
            };
            logPageEvents(pageInstance, log);
            interceptRequestCycle(pageInstance, log);
            return pageInstance;
          }
        };

        logBrowserEvent(browserInstance, log);
        const bproc = browser.process();
        if (bproc !== null) {
          // Triggered on child process stdio streams closing
          bproc.on('close', (_signum: number, signame: NodeJS.Signals) => {
            log.debug(`Browser#${browserInstance.pid()} onClose: ${signame}`);
            browserInstance.events.push('close');
          });

          // Triggered on child process final exit
          bproc.on('exit', (_signum: number, signame: NodeJS.Signals) => {
            log.debug(`Browser#${browserInstance.pid()} onExit: ${signame}`);
            browserInstance.events.push('exit');
          });
        }
        return browserInstance;
      }).catch(error => {
        log.error(error);
        throw error;
      });
    },
    async destroy(browserInstance: BrowserInstance): Promise<void> {
      const browser = browserInstance.browser;
      const isStale = browserInstance.isStale();
      if (isStale) {
        log.debug(`Browser#${browserInstance.pid()} already closed`);
        return;
      }
      return browser.close()
        .then(async () => {
          log.debug(`Browser#${browserInstance.pid()} closed`);
        })
        .catch(async (error) => {
          log.warn(`Browser#${browserInstance.pid()} close error: ${error}`);
        });
    },

    validate(browserInstance: BrowserInstance) {
      log.debug(`validating Browser#${browserInstance.pid()}`);
      return !browserInstance.isStale();
    },

    max: 5, // maximum size of the pool
    min: 1, // minimum size of the pool
  });


  pool.on('acquireRequest', eventId => {
    log.verbose(`pool/event: acquireRequest:${eventId}`);
  });
  pool.on('acquireSuccess', (eventId, resource) => {
    log.verbose(`pool/event: acquireSuccess:${eventId}: ${resource.asString()}`);
  });

  pool.on('acquireFail', (eventId, err) => {
    log.warn(`pool/event: acquireFail:${eventId}: ${err}`);
  });

  // resource returned to pool
  pool.on('release', resource => {
    log.verbose(`pool/event: release ${resource.asString()}`);
  });

  // resource was created and added to the pool
  pool.on('createRequest', eventId => {
    log.verbose(`pool/event: createRequest:${eventId}`);
  });
  pool.on('createSuccess', (eventId, resource) => {
    log.verbose(`pool/event: createSuccess:${eventId}: ${resource.asString()}`);
  });
  pool.on('createFail', (eventId, err) => {
    log.warn(`pool/event: createFail:${eventId} ${err}`);
  });

  // resource is destroyed and evicted from pool
  // resource may or may not be invalid when destroySuccess / destroyFail is called
  pool.on('destroyRequest', (eventId, resource) => {
    log.verbose(`pool/event: destroyRequest:${eventId}: ${resource.asString()}`);
  });
  pool.on('destroySuccess', (eventId, resource) => {
    log.verbose(`pool/event: destroySuccess:${eventId}: ${resource.asString()}`);
  });
  pool.on('destroyFail', (eventId, resource, err) => {
    log.warn(`pool/event: destroyFail:${eventId}: ${resource.asString()} ${err}`);
  });

  // when internal reaping event clock is activated / deactivated
  pool.on('startReaping', () => {
    log.verbose('pool/event: startReaping');
  });
  pool.on('stopReaping', () => {
    log.verbose('pool/event: stopReaping');
  });

  // pool is destroyed (after poolDestroySuccess all event handlers are also cleared)
  pool.on('poolDestroyRequest', eventId => {
    log.verbose(`pool/event: poolDestroyRequest:${eventId}`);
  });

  pool.on('poolDestroySuccess', eventId => {
    log.verbose(`pool/event: poolDestroySuccess:${eventId}`);
  });

  onExit(function (code: number | null, signal: string | null) {
    log.debug(`Node process got ${signal}/${code}; cleaning up browser pool`);
    pool.destroy();
  }, { alwaysLast: false });


  return {
    pool,
    cachedResources: {},
    async acquire(): Promise<BrowserInstance> {
      const acq = pool.acquire();
      const b: BrowserInstance = await acq.promise;
      const pid = b.pid().toString()
      this.cachedResources[pid] = b;
      return b;
    },
    async clearCache(): Promise<void> {
      log.debug('pool.clearCache()');
      const cachedResources = this.cachedResources;
      const cachedInstances: Array<[string, BrowserInstance]> = _.toPairs(cachedResources);
      const cachedBrowsers = _.map(cachedInstances, ([, v]) => v);
      const cachedPIDs = _.map(cachedInstances, ([k]) => k);
      await asyncEach(cachedBrowsers, b => this.release(b));
      _.each(cachedPIDs, pid => {
        delete cachedResources[pid];
      });
    },
    async release(b: BrowserInstance): Promise<void> {
      const pid = b.pid().toString()
      log.debug(`pool.release(B<${pid}>)`);
      delete this.cachedResources[pid];
      let normalShutdown = false;

      b.browser.removeAllListeners();
      const pages = await b.browser.pages();

      await asyncEach(pages, async (page) => {
        const url = page.url();
        page.removeAllListeners();
        log.debug(`    release(Page<${url}>)`);
        return page.close();
      });
      normalShutdown = true;
      if (!normalShutdown) {
        log.warn(`pool.release(B<${pid}>): abnormal shutdown, running kill()`);
        await b.kill();
      }
      pool.release(b);
      log.debug(`pool.release(B<${pid}>): done`);
    },
    async use<A>(f: (browser: BrowserInstance) => A | Promise<A>): Promise<A> {
      const acq = this.pool.acquire();
      const browser = await acq.promise;
      const a = await Promise
        .resolve(f(browser))
        .finally(() => {
          this.pool.release(browser);
        });

      return a;
    },
    async shutdown() {
      log.debug('pool.shutdown()');
      const cachedInstances: Array<[string, BrowserInstance]> = _.toPairs(this.cachedResources);
      const cachedBrowsers = _.map(cachedInstances, ([, v]) => v);
      await asyncEach(cachedBrowsers, b => this.release(b));

      await pool.destroy();
    },
    report() {
      const numFree = this.pool.numFree();
      const numPendingAcquires = this.pool.numPendingAcquires();
      const numPendingCreates = this.pool.numPendingCreates();
      const numPendingValidations = this.pool.numPendingValidations();
      const numUsed = this.pool.numUsed();

      const cachedInstances: Array<[string, BrowserInstance]> = _.toPairs(this.cachedResources);
      const cachedPIDs = _.map(cachedInstances, ([k]) => k);
      const cachedInstanceIds = cachedPIDs.join('; ');

      prettyPrint({
        numUsed,
        numFree,
        numPendingAcquires,
        numPendingCreates,
        numPendingValidations,
        cachedInstanceIds
      });
    },

  };
}

async function gotoUrlSimpleVersion(pageInstance: PageInstance, url: string): Promise<E.Either<string, HTTPResponse>> {
  const { page, opts } = pageInstance;
  const { waitUntil } = opts;

  return page.goto(url, { waitUntil })
    .then(E.right)
    .catch((error: Error) => {
      return E.left(`${error.name}: ${error.message}`);
    })
    ;
}
