import { delay, prettyPrint } from '@watr/commonlib';
import { Pool } from 'tarn';
import _ from 'lodash';

import {
  Browser, Page,
} from 'puppeteer';
import { Logger } from 'winston';
import { logBrowserEvent, logPageEvents } from './page-event';

import { launchBrowser } from './puppet';

export interface BrowserPool {
  pool: Pool<BrowserInstance>;
  acquire(): Promise<BrowserInstance>;
  release(b: BrowserInstance): Promise<void>;
  use<A>(f: (browser: BrowserInstance) => A | Promise<A>): Promise<A>;
  shutdown(): Promise<void>;
  report(): void;
}
export interface BrowserInstance {
  browser: Browser;
  pid(): number;
  logPrefix: string;
  createdAt: Date;
  newPage(): Promise<PageInstance>;
  events: string[];
  isStale(): boolean;
  kill(): Promise<void>;
  inCriticalSection: boolean;
  startCriticalSection(): void;
  endCriticalSection(): void;
}

export interface PageInstance {
  page: Page;
  logPrefix: string;
  createdAt: Date;
}

export function createBrowserPool(log: Logger): BrowserPool {
  const pool = new Pool<BrowserInstance>({
    log(msg: string): void {
      log.info(msg)
    },
    async create(): Promise<BrowserInstance> {
      const logPrefix: string = '';
      return launchBrowser().then(browser => {
        const browserInstance: BrowserInstance = {
          browser,
          inCriticalSection: false,
          async kill(): Promise<void> {
            const bproc = this.browser.process();
            if (bproc === null) return;
            const pid = bproc.pid;
            if (pid === undefined) return;

            return new Promise(resolve => {
              bproc.on('exit', (_signum: number, signame: NodeJS.Signals) => {
                log.debug(`Killed Browser#${pid}: ${signame}`);
                browserInstance.events.push('exit');
                resolve();
              });

              try {
                process.kill(pid, 'SIGKILL');
              } catch (error) {
                log.debug(`process.kill() error: ${error}`);
                this.events.push('exit')
                resolve();
              }
            });

          },
          startCriticalSection(): void {
            this.inCriticalSection = true;
          },
          endCriticalSection(): void {
            this.inCriticalSection = false;
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
            log.debug(`Browser#${browserInstance.pid()} onClose: ${signame}`);
            browserInstance.events.push('close');
          });
          bproc.on('error', (_signum: number, signame: NodeJS.Signals) => {
            log.debug(`Browser#${browserInstance.pid()} onError: ${signame}`);
            browserInstance.events.push('error');
          });
          bproc.on('exit', (_signum: number, signame: NodeJS.Signals) => {
            log.debug(`Browser#${browserInstance.pid()} onExit: ${signame}`);
            browserInstance.events.push('exit');
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
      log.debug(`validating Browser#${browserInstance.pid()}`)
      return !browserInstance.isStale();
    },

    max: 5, // maximum size of the pool
    min: 1, // minimum size of the pool
  });


  // resource is acquired from pool
  pool.on('acquireRequest', eventId => {
    log.verbose(`pool acquireRequest:${eventId}`)
  });
  pool.on('acquireSuccess', (eventId, resource) => {
    log.verbose(`pool acquireSuccess:${eventId}`)
  });
  pool.on('acquireFail', (eventId, err) => {
    log.warn(`pool acquireFail:${eventId}: ${err}`)
  });

  // resource returned to pool
  pool.on('release', resource => {
    log.verbose(`pool release`)
  });

  // resource was created and added to the pool
  pool.on('createRequest', eventId => {
    log.verbose(`pool createRequest:${eventId}`)
  });
  pool.on('createSuccess', (eventId, resource) => {
    log.verbose(`pool createSuccess:${eventId}`)
  });
  pool.on('createFail', (eventId, err) => {
    log.warn(`pool createFail:${eventId} ${err}`)
  });

  // resource is destroyed and evicted from pool
  // resource may or may not be invalid when destroySuccess / destroyFail is called
  pool.on('destroyRequest', (eventId, resource) => {
    log.verbose(`pool destroyRequest:${eventId}`)
  });
  pool.on('destroySuccess', (eventId, resource) => {
    log.verbose(`pool destroySuccess:${eventId}`)
  });
  pool.on('destroyFail', (eventId, resource, err) => {
    log.warn(`pool destroyFail:${eventId} ${err}`)
  });

  // when internal reaping event clock is activated / deactivated
  pool.on('startReaping', () => {
    log.verbose(`pool startReaping`)
  });
  pool.on('stopReaping', () => {
    log.verbose(`pool stopReaping`)
  });

  // pool is destroyed (after poolDestroySuccess all event handlers are also cleared)
  pool.on('poolDestroyRequest', eventId => {
    log.verbose(`pool poolDestroyRequest:${eventId}`)
  });

  pool.on('poolDestroySuccess', eventId => {
    log.verbose(`pool poolDestroySuccess:${eventId}`)
  });


  return {
    pool,
    async acquire(): Promise<BrowserInstance> {
      log.debug(`acquiring..`);
      const acq = pool.acquire();
      return acq.promise;
    },
    async release(b: BrowserInstance): Promise<void> {
      log.debug(`release: getting open pages`)
      let normalShutdown = false;
      const pageCloseP = b.browser.pages()
        .then(async pages => {
          log.debug(`release: cleaning up pages`)
          await Promise.all(pages.map(page => page.close()));
          await b.newPage().then(page => page.page.close());
        }).then(() => {
          normalShutdown = true;
          log.info(`release: normal shutdown success`)
        }).catch(error => {
          log.debug(`release:${error}`)
        });
      await delay(300);
      if (!normalShutdown) {
        log.info(`release: initiating kill()`)
        await b.kill();
      }

      pool.release(b);
    },
    async use<A>(f: (browser: BrowserInstance) => A | Promise<A>): Promise<A> {
      const acq = this.pool.acquire()
      const browser = await acq.promise;
      const a = await Promise.resolve(f(browser));

      this.pool.release(browser);
      return a;
    },
    async shutdown() {
      log.info('pool.shutdown()');
      await pool.destroy();
    },
    report() {
      const numFree = this.pool.numFree()
      const numPendingAcquires = this.pool.numPendingAcquires()
      const numPendingCreates = this.pool.numPendingCreates()
      const numPendingValidations = this.pool.numPendingValidations()
      const numUsed = this.pool.numUsed()
      prettyPrint({
        numUsed,
        numFree,
        numPendingAcquires,
        numPendingCreates,
        numPendingValidations,
      });
    }
  };
}
