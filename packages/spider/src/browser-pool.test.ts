
import { createConsoleLogger } from '@watr/commonlib';
import { createLogger, transports, format } from 'winston';
import { BrowserInstance } from '.';
import { createBrowserPool } from './browser-pool';
import { logPageEvents } from './page-event';

describe('browser pooling', () => {
  it.only('borrow/return to pool', async () => {
    // const logger = createConsoleLogger();
    const logger = createLogger({
      level: 'debug',
      format: format.json(),
      transports: [
        new transports.Console(),
      ],
    });

    const browserPool = createBrowserPool(logger);

    const browserInstance = await browserPool.acquire();
    await browserPool.release(browserInstance);
    const { browser } = browserInstance;
    const page = await browser.newPage();

    logPageEvents(page, logger);

    await page.goto('https://google.com/');
    await page.close();

    await browserPool.shutdown();
  });

  it('shutdown on error', async () => {
    console.log('pos.0');
    const logger = createConsoleLogger();
    const browserPool = createBrowserPool(logger);

    console.log('pos.1');

    await browserPool.use(async (browserInstance: BrowserInstance) => {
      console.log('pos.2');
      throw new Error('problem');
    }).catch((err) => {
      console.log('pos.4');
      console.log('but we are okay now...');
    });

    const browser = await browserPool.acquire();
    await browserPool.release(browser);

    await browserPool.shutdown();

    console.log('pos.7');
  });
});
