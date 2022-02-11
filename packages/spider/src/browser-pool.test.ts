import { getServiceLogger, putStrLn } from '@watr/commonlib';
import { BrowserInstance, createBrowserPool } from './browser-pool';

import Async from 'async';

describe('browser pooling', () => {
  process.env['service-comm.loglevel'] = 'info';
  it('borrow/return to pool', async () => {
    const logger = getServiceLogger('browser-pool');
    const browserPool = createBrowserPool(logger);

    const browserInstance = await browserPool.acquire();
    const { page } = await browserInstance.newPage();

    await page.goto('https://google.com/');
    await page.close();

    await browserPool.release(browserInstance);

    await browserPool.shutdown();
  });

  it('shutdown on error', async () => {
    console.log('pos.0');
    const logger = getServiceLogger('browser-pool');
    const browserPool = createBrowserPool(logger);

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

  const debugUrls = [
    'badcastcrash',
    'crash',
    'crashdump',
    'gpuclean',
    'gpucrash',
    'gpuhang',
    'hang',
    'inducebrowsercrashforrealz',
    'kill',
    'memory-exhaust',
    'memory-pressure-critical',
    'memory-pressure-moderate',
    'ppapiflashcrash',
    'ppapiflashhang',
    'quit',
    'restart',
    'shorthang',
    'webuijserror',
  ]

  it('force kill on hang/timeout', async () => {
    const logger = getServiceLogger('browser-pool');
    const browserPool = createBrowserPool(logger);

    const attemptOne = async (url: string) => {
      const browser = await browserPool.acquire();
      const pageInstance = await browser.newPage();
      const { page } = pageInstance;
      const httpResponseP = page.goto(`chrome://${url}`);

      httpResponseP.then(async () => {
        logger.info('finished page.goto()');
      }).catch(error => {
        logger.info(`httpResponseP error: ${error}`);
      });

      const browserPid = browser.browser.process().pid;

      process.kill(browserPid, 'SIGKILL');

      await browserPool.release(browser);
    }

    await Async.forEachSeries(debugUrls, async (dbgUrl) => {
      putStrLn(`1. Trying chrome://${dbgUrl}`)
      await attemptOne(dbgUrl);
      putStrLn(`2. Trying chrome://${dbgUrl}`)
      await attemptOne(dbgUrl);
    });

    await browserPool.shutdown();
  });
});
