import { getServiceLogger, putStrLn, setLogEnvLevel } from '@watr/commonlib';
import { BrowserInstance, createBrowserPool, DefaultPageInstanceOptions } from './browser-pool';

import Async from 'async';

describe('browser pooling', () => {
  setLogEnvLevel('verbose');

  it('borrow/return to pool', async () => {
    const browserPool = createBrowserPool();

    const browserInstance = await browserPool.acquire();
    const { page } = await browserInstance.newPage(DefaultPageInstanceOptions);

    await page.goto('https://google.com/');
    await page.close();

    await browserPool.release(browserInstance);

    await browserPool.shutdown();
  });

  it('shutdown on error', async () => {
    console.log('pos.0');
    const browserPool = createBrowserPool();

    console.log('pos.1');

    await browserPool.use(async (_browserInstance: BrowserInstance) => {
      console.log('pos.2');
      throw new Error('problem');
    }).catch((_err) => {
      console.log('pos.4');
      console.log('but we are okay now...');
    });

    const browser = await browserPool.acquire();
    await browserPool.release(browser);

    await browserPool.shutdown();

    console.log('pos.7');
  });

  ///// Debug urls to simulate events in chrome, call as chrome://url
  const debugUrls = [
    'not-valid-url',
    'badcastcrash',
    'crash',
    'crashdump',
    'hang',
    'kill',
    'memory-exhaust',
    'shorthang',

    ///// Not valid debug urls in puppeteer's chrome (but should be according to documentation)
    // 'gpuclean',
    // 'gpucrash',
    // 'gpuhang',
    // 'inducebrowsercrashforrealz',
    // 'memory-pressure-critical',
    // 'memory-pressure-moderate',
    // 'ppapiflashcrash',
    // 'ppapiflashhang',
    // 'quit',
    // 'restart',
    // 'webuijserror',
  ];

  it('force kill on hang/timeout', async () => {
    const logger = getServiceLogger('browser-pool');
    const browserPool = createBrowserPool();

    const attemptOne = async (url: string) => {
      putStrLn(`attempting ${url}`);
      const browser = await browserPool.acquire();
      putStrLn('acquired browser');
      const pageInstance = await browser.newPage(DefaultPageInstanceOptions);
      putStrLn('acquired page');
      const { page } = pageInstance;
      putStrLn('navigating...');
      const httpResponseP = page.goto(`chrome://${url}`, { timeout: 2000 });

      const resp = httpResponseP.then(async () => {
        logger.info(`finished page.goto( ${url} )`);
      }).catch(error => {
        logger.info(`httpResponse: ${error}`);
      });

      putStrLn('await resp');
      await resp;
      putStrLn('await release');
      await browserPool.release(browser);
      putStrLn('/done attempt');
    };

    await Async.forEachSeries(debugUrls, async (dbgUrl) => {
      putStrLn(`1. Trying chrome://${dbgUrl}`);
      await attemptOne(dbgUrl);
      putStrLn(`2. Trying chrome://${dbgUrl}`);
      await attemptOne(dbgUrl);
    });

    await browserPool.shutdown();
  });

  it('close all remaining browserInstances on pool.shutdown()', async () => {
    const browserPool = createBrowserPool();
    putStrLn('Acquiring browserInstances without releasing...');
    await browserPool.acquire();
    await browserPool.acquire();
    const bi = await browserPool.acquire();
    putStrLn('Navigating to page');
    const bp = await bi.newPage(DefaultPageInstanceOptions);
    const httpResponse = await bp.gotoUrl('chrome://shorthang');
    browserPool.report();
    putStrLn('Pool Shutdown');
    await browserPool.shutdown();
  });
});
