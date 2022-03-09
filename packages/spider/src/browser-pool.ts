import { delay, prettyPrint } from '@watr/commonlib';
import { Pool } from 'tarn';
import _ from 'lodash';

// import onExit from 'signal-exit';
const onExit = require('signal-exit');

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
      console.log('create.1')
      return launchBrowser().then(browser => {
        const browserInstance: BrowserInstance = {
          browser,
          async kill(): Promise<void> {
            const bproc = this.browser.process();
            if (bproc === null) return;
            const pid = bproc.pid;
            if (pid === undefined) return;

            return new Promise(resolve => {
              bproc.removeAllListeners();
              // bproc.disconnect();

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

        console.log('create.2')
        logBrowserEvent(browserInstance, log);
        console.log('create.3')
        const bproc = browser.process();
        console.log('create.4')
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
        console.log('create.5')
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
      // return Promise.race([
      //   browserInstance.newPage().then(p => p.page.close()).then(() => true),
      //   delay(200).then(() => false)
      // ]).then(succ => {
      //   return succ && !browserInstance.isStale();
      // })
      return !browserInstance.isStale();
    },

    max: 5, // maximum size of the pool
    min: 1, // minimum size of the pool
  });


  pool.on('acquireRequest', eventId => {
    log.verbose(`pool/event: acquireRequest:${eventId}`)
  });
  pool.on('acquireSuccess', (eventId, resource) => {
    log.verbose(`pool/event: acquireSuccess:${eventId}`)
  });
  pool.on('acquireFail', (eventId, err) => {
    log.warn(`pool/event: acquireFail:${eventId}: ${err}`)
  });

  // resource returned to pool
  pool.on('release', resource => {
    log.verbose(`pool/event: release`)
  });

  // resource was created and added to the pool
  pool.on('createRequest', eventId => {
    log.verbose(`pool/event: createRequest:${eventId}`)
  });
  pool.on('createSuccess', (eventId, resource) => {
    log.verbose(`pool/event: createSuccess:${eventId}`)
  });
  pool.on('createFail', (eventId, err) => {
    log.warn(`pool/event: createFail:${eventId} ${err}`)
  });

  // resource is destroyed and evicted from pool
  // resource may or may not be invalid when destroySuccess / destroyFail is called
  pool.on('destroyRequest', (eventId, resource) => {
    log.verbose(`pool/event: destroyRequest:${eventId}`)
  });
  pool.on('destroySuccess', (eventId, resource) => {
    log.verbose(`pool/event: destroySuccess:${eventId}`)
  });
  pool.on('destroyFail', (eventId, resource, err) => {
    log.warn(`pool/event: destroyFail:${eventId} ${err}`)
  });

  // when internal reaping event clock is activated / deactivated
  pool.on('startReaping', () => {
    log.verbose(`pool/event: startReaping`)
  });
  pool.on('stopReaping', () => {
    log.verbose(`pool/event: stopReaping`)
  });

  // pool is destroyed (after poolDestroySuccess all event handlers are also cleared)
  pool.on('poolDestroyRequest', eventId => {
    log.verbose(`pool/event: poolDestroyRequest:${eventId}`)
  });

  pool.on('poolDestroySuccess', eventId => {
    log.verbose(`pool/event: poolDestroySuccess:${eventId}`)
  });

  console.log('setMaxListeners')
  process.setMaxListeners(8);

  onExit(function(code: number | null, signal: string | null) {
    console.log(`Node process got ${signal}/${code}; cleaning up browser pool`);
    pool.destroy();
  }, { alwaysLast: false });

  // function cleanup(exitCode: string): void {
  //   console.log(`Node process got (${exitCode}); cleaning up browser pool`);
  //   pool.destroy();
  // }

  // process.on('exit', (_signum: number, signame: NodeJS.Signals) => {
  //   cleanup(signame);
  // });
  // process.on('disconnected', (_signum: number, signame: NodeJS.Signals) => {
  //   cleanup(signame);
  // });

  // process.on('close', (_signum: number, signame: NodeJS.Signals) => {
  //   cleanup(signame);
  // });
  // process.on('SIGINT', (_signum: number, signame: NodeJS.Signals) => {
  //   console.log(`got ${signame}`)
  //   cleanup(signame);
  // });
  // process.on('SIGTERM', (_signum: number, signame: NodeJS.Signals) => {
  //   console.log(`got ${signame}`)
  //   cleanup(signame);
  // });

  // process.on('SIGHUP', (_signum: number, signame: NodeJS.Signals) => {
  //   console.log(`got ${signame}`)
  //   cleanup(signame);
  // });
  // process.on('SIGKILL', (_signum: number, signame: NodeJS.Signals) => {
  //   console.log(`got ${signame}`)
  //   cleanup(signame);
  // });

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
          log.debug(`release: closing all pages`)
          await Promise.all(pages.map(page => page.close()));
          log.debug(`release: open/close test page`)
          const page = await b.newPage();
          await page.page.goto('about:blank');
          await page.page.close()
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
      log.debug(`release: awaiting pageClose`)
      // await pageCloseP;

      log.debug(`release: done`)
      pool.release(b);
    },
    async use<A>(f: (browser: BrowserInstance) => A | Promise<A>): Promise<A> {
      const acq = this.pool.acquire()
      const browser = await acq.promise;
      const a = await Promise
        .resolve(f(browser))
        .finally(() => {
          this.pool.release(browser);
        });

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
