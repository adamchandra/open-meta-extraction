import _ from 'lodash';

import * as E from 'fp-ts/Either';
import { onExit } from 'signal-exit';
import { Pool } from 'tarn';

import {
  HTTPResponse,
  PuppeteerLifeCycleEvent
} from 'puppeteer';

import { asyncEach, getServiceLogger, prettyPrint } from '@watr/commonlib';

import {
  Browser, Page,
} from 'puppeteer';
import { interceptRequestCycle, logBrowserEvent, interceptPageEvents } from './page-event';

import { launchBrowser } from './puppet';
import { BlockableResource, RewritableUrl, RewritableUrls } from './resource-blocking';
import { Logger } from 'winston';

export class BrowserPool {
  pool: Pool<BrowserInstance>;
  cachedResources: Record<string, BrowserInstance>;
  log: Logger;

  constructor(pool: Pool<BrowserInstance>) {
    this.pool = pool;
    this.log = getServiceLogger('BrowserPool')
    this.cachedResources = {};
  }
  async acquire(): Promise<BrowserInstance> {
    const acq = this.pool.acquire();
    const b: BrowserInstance = await acq.promise;
    const pid = b.pid().toString()
    this.cachedResources[pid] = b;
    return b;

  }
  async release(b: BrowserInstance): Promise<void> {
    const pid = b.pid().toString()
    this.log.debug(`this.pool.release(B<${pid}>)`);
    delete this.cachedResources[pid];
    let normalShutdown = false;

    b.browser.removeAllListeners();
    const pages = await b.browser.pages();

    await asyncEach(pages, async (page) => {
      const url = page.url();
      page.removeAllListeners();
      this.log.debug(`    release(Page<${url}>)`);
      return page.close();
    });
    normalShutdown = true;
    // if (!normalShutdown) {
    //   this.log.warn(`this.pool.release(B<${pid}>): abnormal shutdown, running kill()`);
    //   await b.kill();
    // }
    await b.kill();
    // b.browser.
    this.pool.release(b);
    this.log.debug(`this.pool.release(B<${pid}>): done`);

  }
  async use<A>(f: (browser: BrowserInstance) => A | Promise<A>): Promise<A> {
    const acq = this.pool.acquire();
    const browser = await acq.promise;
    const a = await Promise
      .resolve(f(browser))
      .finally(() => {
        this.pool.release(browser);
      });

    return a;

  }
  async shutdown(): Promise<void> {
    this.log.debug('pool.shutdown()');
    const cachedInstances: Array<[string, BrowserInstance]> = _.toPairs(this.cachedResources);
    const cachedBrowsers = _.map(cachedInstances, ([, v]) => v);
    await asyncEach(cachedBrowsers, b => this.release(b));

    await this.pool.destroy();

  }
  report(): void {
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

  }
  async clearCache(): Promise<void> {
    this.log.debug('pool.clearCache()');
    const cachedResources = this.cachedResources;
    const cachedInstances: Array<[string, BrowserInstance]> = _.toPairs(cachedResources);
    const cachedBrowsers = _.map(cachedInstances, ([, v]) => v);
    const cachedPIDs = _.map(cachedInstances, ([k]) => k);
    await asyncEach(cachedBrowsers, b => this.release(b));
    _.each(cachedPIDs, pid => {
      delete cachedResources[pid];
    });

  }
}

export class BrowserInstance {
  browser: Browser;
  logPrefix: string;
  createdAt: Date;
  events: string[];
  log: Logger;

  constructor(b: Browser) {
    this.browser = b;
    this.logPrefix = '';
    this.createdAt = new Date();
    this.events = [];
    this.log = getServiceLogger('Browser')
  }

  async setupBrowser() {
    // TODO either re-instantiate browser or just setup event logging
    logBrowserEvent(this, this.log);
    const bproc = this.browser.process();
    if (bproc !== null) {
      // Triggered on child process stdio streams closing
      bproc.on('close', (_signum: number, signame: NodeJS.Signals) => {
        this.log.debug(`Browser#${this.pid()} onClose: ${signame} / ${_signum}`);
        this.events.push('close');
      });

      // Triggered on child process final exit
      bproc.on('exit', (_signum: number, signame: NodeJS.Signals) => {
        this.log.debug(`Browser#${this.pid()} onExit: ${signame} / ${_signum}`);
        this.events.push('exit');
      });
    }
  }

  pid(): number {

    const proc = this.browser.process();
    if (proc === null) return -1;
    const pid = proc.pid;
    return pid === undefined ? -1 : pid;
  }

  async newPage(opts: PageInstanceOptions): Promise<PageInstance> {
    this.log.debug('newPage:begin');
    this.log.debug(`newPage:browser.isConnected()=${this.browser.isConnected()}`);

    const page = await this.browser.newPage();
    this.log.debug('newPage:acquired');
    page.setDefaultNavigationTimeout(opts.defaultNavigationTimeout);
    page.setDefaultTimeout(opts.defaultTimeout);
    page.setJavaScriptEnabled(opts.javaScriptEnabled);
    page.setRequestInterception(opts.requestInterception);
    this.log.debug('newPage:setProps');

    const pageInstance = new PageInstance(page, opts);
    interceptPageEvents(pageInstance, this.log);
    interceptRequestCycle(pageInstance, this.log);
    this.log.debug('newPage:done');
    return pageInstance;

  }
  isStale(): boolean {
    const closedOrExited = this.events.some(s => s === 'close' || s === 'exit');
    return closedOrExited;

  }
  async kill(): Promise<void> {
    const bproc = this.browser.process();
    if (bproc === null) return;

    const pid = bproc.pid;
    if (pid === undefined) return;

    return new Promise(resolve => {
      bproc.removeAllListeners();

      bproc.on('exit', (_signum: number, signame: NodeJS.Signals) => {
        this.log.debug(`Killed Browser#${pid}: ${signame}`);
        this.events.push('exit');
        resolve();
      });

      try {
        process.kill(pid, 'SIGKILL');
      } catch (error) {
        this.log.debug(`process.kill() error: ${error}`);
        this.events.push('exit');
        resolve();
      }
    });
  }

  asString(): string {
    const pid = this.pid();
    return `Browser#${pid}`;
  }
}

export class PageInstance {
  page: Page;
  logPrefix: string;
  createdAt: Date;
  opts: PageInstanceOptions;

  constructor(page: Page, opts: PageInstanceOptions) {
    this.page = page;
    this.createdAt = new Date();
    this.opts = opts;
    this.logPrefix = '';
  }

  async gotoUrl(url: string): Promise<E.Either<string, HTTPResponse>> {
    return gotoUrlSimpleVersion(this, url);
  }
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



export function createUnderlyingPool(): Pool<BrowserInstance> {
  const log = getServiceLogger(`pool<browser>`);
  const pool = new Pool<BrowserInstance>({
    async create(): Promise<BrowserInstance> {
      return launchBrowser().then(browser => {
        const browserInstance = new BrowserInstance(browser);

        logBrowserEvent(browserInstance, log);
        const bproc = browser.process();
        if (bproc !== null) {
          // Triggered on child process stdio streams closing
          bproc.on('close', (_signum: number, signame: NodeJS.Signals) => {
            log.debug(`Browser#${browserInstance.pid()} onClose: ${signame} / ${_signum}`);
            browserInstance.events.push('close');
          });

          // Triggered on child process final exit
          bproc.on('exit', (_signum: number, signame: NodeJS.Signals) => {
            log.debug(`Browser#${browserInstance.pid()} onExit: ${signame} / ${_signum}`);
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

  onExit(function (code?: number | null , signal?: string | null) {
    log.debug(`Node process got ${signal}/${code}; cleaning up browser pool`);
    pool.destroy();
  }, { alwaysLast: false });

  return pool;
}


export function createBrowserPool(): BrowserPool {
  const pool = createUnderlyingPool();
  const browserPool = new BrowserPool(pool);
  return browserPool;
}



async function gotoUrlSimpleVersion(pageInstance: PageInstance, url: string): Promise<E.Either<string, HTTPResponse>> {
  const { page, opts } = pageInstance;
  const { waitUntil } = opts;

  return page.goto(url, { waitUntil })
    .then(resp => {
      if (resp === null) {
        return E.left(`null HTTPResponse to ${url}`);
      }
      return E.right(resp);
    })
    .catch((error: Error) => {
      return E.left(`${error.name}: ${error.message}`);
    })
    ;
}
